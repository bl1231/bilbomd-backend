import express from 'express'
import { submitApiJob } from '../controllers/external/createJob.js'
import { getApiJobStatus } from '../controllers/external/jobStatus.js'
import { getExternalJobResults } from '../controllers/external/getResults.js'
import { verifyAPIToken } from '../middleware/verifyAPIToken.js'
import { logApiRequest } from '../middleware/logApiRequests.js'

const router = express.Router()

router.use(verifyAPIToken)
router.use(logApiRequest)

/**
 * @swagger
 * /external/jobs:
 *   post:
 *     summary: Submit a new job
 *     tags: [External]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             oneOf:
 *               - title: PDB Job
 *                 required: [title, bilbomd_mode, pdb_file, crd_file, const_inp_file, dat_file]
 *                 properties:
 *                   bilbomd_mode:
 *                     type: string
 *                     enum: [pdb]
 *                   title:
 *                     type: string
 *                   pdb_file:
 *                     type: string
 *                     format: binary
 *                   crd_file:
 *                     type: string
 *                     format: binary
 *                   const_inp_file:
 *                     type: string
 *                     format: binary
 *                   dat_file:
 *                     type: string
 *                     format: binary
 *               - title: CRD/PSF Job
 *                 required: [title, bilbomd_mode, crd_file, psf_file, const_inp_file, dat_file]
 *                 properties:
 *                   bilbomd_mode:
 *                     type: string
 *                     enum: [crd_psf]
 *                   title:
 *                     type: string
 *                   crd_file:
 *                     type: string
 *                     format: binary
 *                   psf_file:
 *                     type: string
 *                     format: binary
 *                   const_inp_file:
 *                     type: string
 *                     format: binary
 *                   dat_file:
 *                     type: string
 *                     format: binary
 *               - title: Auto Job
 *                 required: [title, bilbomd_mode, pdb_file, pae_file, dat_file]
 *                 properties:
 *                   bilbomd_mode:
 *                     type: string
 *                     enum: [auto]
 *                   title:
 *                     type: string
 *                   pdb_file:
 *                     type: string
 *                     format: binary
 *                   pae_file:
 *                     type: string
 *                     format: binary
 *                   dat_file:
 *                     type: string
 *                     format: binary
 *               - title: AlphaFold Job
 *                 required: [title, bilbomd_mode, dat_file, entities_json]
 *                 properties:
 *                   bilbomd_mode:
 *                     type: string
 *                     enum: [alphafold]
 *                   title:
 *                     type: string
 *                   dat_file:
 *                     type: string
 *                     format: binary
 *                   entities_json:
 *                     type: string
 *     responses:
 *       200:
 *         description: Job submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "New auto job successfully created"
 *                 jobid:
 *                   type: string
 *                   example: "680aa4ffce4a325a086cbced"
 *                 uuid:
 *                   type: string
 *                   example: "f4ba7568-369a-465a-b0d1-a78969bb816b"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenAlphaFold'
 */
router.post('/', submitApiJob)

/**
 * @swagger
 * /external/{id}/status:
 *   get:
 *     summary: Get job status
 *     tags: [External]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The MongoDB job ID
 *     responses:
 *       200:
 *         description: Job status returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobStatusResponse'
 *       400:
 *         description: Invalid job ID
 *         content:
 *           application/json:
 *             example:
 *               message: "Invalid job ID format"
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             example:
 *               message: "No job found with ID: 680aa4ffce4a325a086cbced"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Server error retrieving job status
 *         content:
 *           application/json:
 *             example:
 *               message: "Failed to retrieve job status"
 */
router.get('/:id/status', getApiJobStatus)

/**
 * @swagger
 * /external/{id}/results:
 *   get:
 *     summary: Download job results as a tarball archive
 *     tags: [External]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the job (either Job or MultiJob)
 *     responses:
 *       200:
 *         description: A tarball archive containing the job results
 *         content:
 *           application/gzip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             examples:
 *               MissingID:
 *                 summary: Missing job ID
 *                 value:
 *                   message: Job ID required.
 *               NotCompleted:
 *                 summary: Job not yet completed
 *                 value:
 *                   message: "Job is not complete (status: Running). You may only download results for a job that has completed successfully."
 *               NullDoc:
 *                 summary: Job document is null or undefined
 *                 value:
 *                   message: Job document is null or undefined.
 *       404:
 *         description: Job or result file not found
 *         content:
 *           application/json:
 *             examples:
 *               NoJob:
 *                 summary: Job not found
 *                 value:
 *                   message: "No job matches ID 680aa4ffce4a325a086cbced."
 *               NoResultsFile:
 *                 summary: Results file missing
 *                 value:
 *                   message: Results file not found.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             examples:
 *               DownloadError:
 *                 summary: Error during file download
 *                 value:
 *                   message: "Could not download the file: ENOENT: no such file or directory"
 *               Unexpected:
 *                 summary: Unexpected server error
 *                 value:
 *                   message: An error occurred while processing your request.
 */
router.get('/:id/results', getExternalJobResults)

export default router
