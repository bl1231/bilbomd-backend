const express = require('express')
const router = express.Router()
const { createBullBoard } = require('@bull-board/api')
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter')
const { ExpressAdapter } = require('@bull-board/express')

router.route('/').get()

module.exports = router
