import fs from 'fs/promises'
import { logger } from '../../middleware/loggers.js'

const fromCharmmGui = (file: File): Promise<boolean> => {
  const charmmGui = /CHARMM-GUI/
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onloadend = () => {
      const lines = (reader.result as string).split(/[\r\n]+/g)
      for (let line = 0; line < 5; line++) {
        // console.log(charmmGui.test(lines[line]), 'line', line, lines[line])
        if (charmmGui.test(lines[line])) {
          // console.log(lines[line])
          resolve(true)
        }
      }
      resolve(false)
    }
  })
}

const isCRD = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onloadend = () => {
      const lines = (reader.result as string).split(/[\r\n]+/)
      let starLinesCount = 0
      let foundEndPattern = false

      // Check for lines starting with *
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('*')) {
          starLinesCount++
          if (starLinesCount > 6) {
            // More than 6 lines starting with *, not matching the pattern
            break
          }
        } else {
          // Check if the line immediately after the last *-line matches the specified pattern
          if (starLinesCount >= 2 && starLinesCount <= 6) {
            const endPattern = /^\s+\d+\s+EXT$/
            foundEndPattern = endPattern.test(lines[i])
          }
          break // No more lines starting with * consecutively, exit the loop
        }
      }

      resolve(foundEndPattern)
    }
  })
}

const isPsfData = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    // console.log(`validate if ${file.name} isPsfData`)
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onloadend = () => {
      const lines = (reader.result as string).split(/[\r\n]+/g)
      const atomRegex =
        /^\s*\d+\s+[A-Z]{4}\s+\d+\s+[A-Z]{3,}\s+[a-zA-Z0-9_']+\s+[a-zA-Z0-9_']+\s+-?\d+\.\d+(?:[eE][+-]?\d+)?\s+\d+\.\d+(?:[eE][+-]?\d+)?\s+\d+/

      if (!lines[0].includes('PSF')) {
        // console.log('first line does not contain PSF')
        resolve(false)
        return
      }

      if (!lines.some((line) => line.trim().endsWith('!NTITLE'))) {
        // console.log('NTITLE missing')
        resolve(false)
        return
      }

      const natomLineIndex = lines.findIndex((line) => /\d+\s+!NATOM/.test(line))
      if (natomLineIndex === -1) {
        // console.log('!NATOM line not found')
        resolve(false)
        return
      }

      const natomResult = lines[natomLineIndex].match(/(\d+)\s+!NATOM/)
      if (!natomResult) {
        // console.log('Failed to capture number of atoms')
        resolve(false)
        return
      }

      const natom = parseInt(natomResult[1], 10)
      // console.log('natom expected = ', natom)
      if (isNaN(natom)) {
        resolve(false)
        return
      }

      // Check for atom lines directly following the !NATOM line
      const atomLines = lines.slice(natomLineIndex + 1, natomLineIndex + 1 + natom)
      // console.log('num atom lines = ', atomLines.length)
      if (atomLines.length !== natom) {
        // console.log('Incorrect number of atom lines')
        resolve(false)
        return
      }

      for (const line of atomLines) {
        if (!atomRegex.test(line)) {
          // console.log('Failed atom regex:', line)
          resolve(false)
          return
        }
      }

      resolve(true)
    }

    reader.onerror = () => {
      // console.log('Error reading the file')
      resolve(false)
    }
  })
}

const noSpaces = (file: File): Promise<boolean> => {
  const spaces = /\s/
  return new Promise((resolve) => {
    if (spaces.test(file.name)) {
      // console.log('false', file.name)
      resolve(false)
    }
    resolve(true)
  })
}

const isSaxsData = async (
  file: Express.Multer.File,
  minValidLines = 100
): Promise<{ valid: boolean; message?: string }> => {
  const sciNotation = /-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g

  try {
    const text = await fs.readFile(file.path, 'utf8')
    const lines = text.split(/[\r\n]+/g)

    let validLineCount = 0
    let totalDataLines = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1 // 1-based index for readability

      if (line.startsWith('#') || line.trim() === '') continue

      totalDataLines++

      const numbers = line.match(sciNotation)
      if (!numbers || numbers.length < 3) {
        logger.info(
          `Line ${lineNum}: Rejected due to insufficient numeric columns → ${line}`
        )
        continue
      }

      const q = parseFloat(numbers[0])
      const iVal = parseFloat(numbers[1])
      const err = parseFloat(numbers[2])

      if ([q, iVal, err].some((n) => isNaN(n))) {
        logger.info(
          `Line ${lineNum}: Rejected due to NaN q/i/err → [${q}, ${iVal}, ${err}]`
        )
        continue
      }

      if (q < 0.005 || q > 1.0) {
        logger.info(`Line ${lineNum}: Rejected due to q out of range → q=${q}`)
        continue
      }

      if (iVal <= 0 || err <= 0) {
        logger.info(
          `Line ${lineNum}: Rejected due to I(q) or σ <= 0 → I=${iVal}, σ=${err}`
        )
        continue
      }

      validLineCount++

      if (validLineCount >= minValidLines) {
        return { valid: true }
      }
    }

    return {
      valid: false,
      message: `SAXS data File contains ${validLineCount} valid lines out of ${totalDataLines}. We require at least ${minValidLines} valid SAXS data lines with q, I(q), and error.`
    }
  } catch (err) {
    logger.error('Error reading SAXS file:', err)
    return {
      valid: false,
      message: 'Error reading SAXS file content'
    }
  }
}

const containsChainId = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target && e.target.result) {
        const text = e.target.result as string
        const lines = text.split('\n')
        const isValid = lines.some((line) => {
          return (
            (line.startsWith('ATOM') || line.startsWith('HETATM')) &&
            /^[A-Za-z]$/.test(line[21])
          )
        })
        resolve(isValid)
      } else {
        reject(new Error('File load error: Event target or result is null'))
      }
    }
    reader.onerror = (e) => reject(new Error('Error reading file: ' + e))
    reader.readAsText(file)
  })
}

const isRNA = (file: File): Promise<{ valid: boolean; message?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsText(file)
    reader.onloadend = () => {
      const lines = (reader.result as string).split(/\r?\n/)
      const validNucleotides = new Set(['A', 'C', 'G', 'U'])

      for (const line of lines) {
        if (line.startsWith('HETATM')) {
          resolve({
            valid: false,
            message: 'File contains HETATM lines which are not allowed.'
          })
          return
        }

        if (line.startsWith('ATOM')) {
          const parts = line.split(/\s+/)
          const residueName = parts[3]

          if (residueName.length !== 1 || !validNucleotides.has(residueName)) {
            resolve({
              valid: false,
              message: `Invalid residue name '${residueName}'. Expected A, C, G, U.`
            })
            return
          }
        }
      }

      resolve({ valid: true }) // File passes all checks
    }

    reader.onerror = () => {
      resolve({ valid: false, message: 'Error reading the file.' })
    }
  })
}

const isValidConstInpFile = (file: File, mode: string): Promise<string | true> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (!e.target || !e.target.result) {
        reject(new Error('File load error: Event target or result is null'))
        return
      }

      const text = e.target.result as string
      const lines = text.split('\n').filter((line) => line.trim() !== '') // Filter out empty lines

      // Check if any line exceeds 70 characters
      // for (let i = 0; i < lines.length; i++) {
      //   if (lines[i].length > 70) {
      //     resolve(`Line ${i + 1} exceeds 70 characters.`)
      //     return
      //   }
      // }

      // Check if the last non-empty line is exactly 'return'
      if (lines.length === 0 || lines[lines.length - 1].trim() !== 'return') {
        resolve('The last line must be "return".')
        return
      }

      // Check for at least one 'define' and one 'cons fix sele' line
      const hasDefine = lines.some((line) => line.startsWith('define'))
      if (!hasDefine) {
        resolve('At least one line must start with "define".')
        return
      }

      const hasConsFixSele = lines.some((line) => line.startsWith('cons fix sele'))
      if (!hasConsFixSele) {
        resolve('At least one line must start with "cons fix sele".')
        return
      }

      // Check 'define' lines for 'segid' followed by the correct format
      // console.log('isValidConstInpFile mode: ', mode)
      if (mode === 'pdb') {
        const segidRegex = /segid\s+((PRO|DNA|RNA|CAR|CAL)[A-Z])\b/
        const validSegid = lines
          .filter((line) => line.startsWith('define'))
          .every((line) => segidRegex.test(line))
        // console.log(file.name, ' valid segid is ', validSegid)
        if (!validSegid) {
          resolve('segid must be: PRO[A-Z], DNA[A-Z], RNA[A-Z], etc.')
          return
        }
      } else if (mode === 'crd_psf') {
        const segidRegex = /segid\s+([A-Z]{4})\b/
        const validSegid = lines
          .filter((line) => line.startsWith('define'))
          .every((line) => segidRegex.test(line))
        // console.log(file.name, ' valid segid is ', validSegid)
        if (!validSegid) {
          resolve('segid must contain 4 uppercase letters [A-Z]')
          return
        }
      }

      resolve(true) // All checks passed
    }

    reader.onerror = () => reject(new Error('Error reading file'))
    reader.readAsText(file)
  })
}

export {
  fromCharmmGui,
  isCRD,
  isPsfData,
  noSpaces,
  isSaxsData,
  isRNA,
  containsChainId,
  isValidConstInpFile
}
