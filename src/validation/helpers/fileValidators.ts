import type { Express } from 'express'
import { mixed } from 'yup'
import { isSaxsData } from './validationFunctions.js'
import { logger } from '../../middleware/loggers.js'

export const requiredFile = (message: string) =>
  mixed().test('required', message, (file) => !!file && typeof file === 'object')

export const fileExtTest = (ext: string) =>
  mixed().test('file-type-check', `Only accepts a *.${ext} file.`, function (value) {
    const file = value as Express.Multer.File | undefined
    return file?.originalname?.toLowerCase().endsWith(`.${ext}`)
  })

export const fileSizeTest = (maxSize: number) =>
  mixed().test(
    'file-size-check',
    `Max file size is ${maxSize / 1_000_000}MB`,
    function (value) {
      const file = value as Express.Multer.File | undefined
      return file?.size != null && file.size <= maxSize
    }
  )

export const fileNameLengthTest = () =>
  mixed().test(
    'filename-length-check',
    'Filename must be no longer than 30 characters.',
    function (value) {
      const file = value as Express.Multer.File | undefined
      return file?.originalname?.length !== undefined && file.originalname.length <= 30
    }
  )

export const noSpacesTest = () =>
  mixed().test(
    'check-for-spaces',
    'No spaces allowed in the file name.',
    function (value) {
      const file = value as Express.Multer.File | undefined
      return !file?.originalname?.includes(' ')
    }
  )

export const saxsCheck = () =>
  mixed().test(
    'saxs-data-check',
    'File does not appear to be SAXS data',
    async function (value) {
      const file = value as Express.Multer.File | undefined
      logger.info(`saxsCheck(): file = ${file?.originalname}, path = ${file?.path}`)

      if (!file?.path) {
        return this.createError({ message: 'Missing SAXS file path for validation.' })
      }

      try {
        const result = await isSaxsData(file)

        if (result.valid) return true

        return this.createError({ message: result.message ?? 'SAXS data invalid.' })
      } catch (err) {
        // Log what actually went wrong
        logger.error('Error in saxsCheck():', err)
        return this.createError({ message: 'Unexpected error during SAXS validation' })
      }
    }
  )
