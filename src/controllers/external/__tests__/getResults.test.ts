import { describe, test, expect, vi } from 'vitest'
import { getExternalJobResults } from '../getResults'
import { logger } from '../../../middleware/loggers'

// Mock the downloadJobResults function
vi.mock('../../jobs/downloadJobResults', () => ({
  downloadJobResults: vi.fn()
}))

import { downloadJobResults } from '../../jobs/downloadJobResults'

describe('getExternalJobResults', () => {
  test('should call downloadJobResults and log messages', async () => {
    const req = { params: { id: 'abc123' } } as any
    const res = {} as any

    const logInfo = vi.spyOn(logger, 'info').mockImplementation(() => {})
    ;(downloadJobResults as any).mockResolvedValue(undefined)

    await getExternalJobResults(req, res)

    expect(downloadJobResults).toHaveBeenCalledWith(req, res)
    expect(logInfo).toHaveBeenCalledWith(
      'External API request to download job results for job ID abc123'
    )
    expect(logInfo).toHaveBeenCalledWith(
      'Completed external job result download for job ID abc123'
    )
  })

  test('should return 500 and log error if downloadJobResults throws', async () => {
    const req = { params: { id: 'xyz789' } } as any
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const res = { status } as any

    ;(downloadJobResults as any).mockRejectedValue(new Error('fail'))

    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {})

    await getExternalJobResults(req, res)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      message: 'Unexpected error during external job result download.'
    })
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('getExternalJobResults error:')
    )
  })

  test('should handle missing job ID gracefully (optional)', async () => {
    const req = { params: {} } as any
    const res = {} as any

    const logInfo = vi.spyOn(logger, 'info').mockImplementation(() => {})
    ;(downloadJobResults as any).mockResolvedValue(undefined)

    await getExternalJobResults(req, res)

    expect(downloadJobResults).toHaveBeenCalledWith(req, res)
    expect(logInfo).toHaveBeenCalledWith(
      'External API request to download job results for job ID undefined'
    )
  })
})
