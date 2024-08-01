import { logger } from '../middleware/loggers'
import { Request, Response } from 'express'
import { queueJob } from '../queues/webhooks'
import { v4 as uuid } from 'uuid'
import { WebhookPayload } from '../types//github-payload'

// Define the function to handle incoming webhooks
const handleWebhook = (req: Request, res: Response): void => {
  try {
    // Extract the event type from the URL parameter
    const eventType: string = req.params.event

    // Extract the payload from the request body
    const payload: WebhookPayload = req.body

    // Add logic to handle different event types
    switch (eventType) {
      case 'docker-build':
        // Call a function to handle the Docker build event
        handleDockerBuild(payload)
        break
      case 'deploy':
        // Call a function to handle the deploy event
        handleDeploy(payload)
        break
      // Add more cases as needed for different events
      default:
        logger.warn(`Unhandled event type: ${eventType}`)
        res.status(400).json({ message: `Unhandled event type: ${eventType}` })
        return
    }

    // Send a success response
    res.status(200).json({ message: 'Webhook processed successfully' })
  } catch (error) {
    // Handle any errors that occur during processing
    logger.error('Error processing webhook:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

const handleDockerBuild = async (payload: WebhookPayload) => {
  const UUID = uuid()

  logger.info(
    `Handling Docker build event for repository: ${payload.repository?.full_name}`
  )
  // logger.info(`payload: ${JSON.stringify(payload)}`)
  logger.info(`TAG: ${payload.package.package_version.container_metadata.tag.name}`)

  const BullId = await queueJob({
    type: 'docker-build',
    title: 'Docker Build',
    uuid: UUID
  })

  logger.info(`Docker Build Job assigned BullMQ ID: ${BullId}`)
}

// Example function to handle a deploy event
const handleDeploy = (payload: WebhookPayload): void => {
  // Implement logic to handle the deploy event
  logger.info('Handling deploy event for repository:', payload.repository?.full_name)
  // More processing logic...
}

export { handleWebhook }
