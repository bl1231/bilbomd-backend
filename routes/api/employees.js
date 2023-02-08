const express = require('express')
const router = express.Router()
const employeesController = require('../../controllers/employeesController')
//const ROLES_LIST = require('../../config/roles_list');
const verifyRoles = require('../../middleware/verifyRoles')

router
  .route('/')
  .get(employeesController.getAllEmployees)
  .post(employeesController.createNewEmployee)
  .put(employeesController.updateEmployee)
  .delete(employeesController.deleteEmployee)

router.route('/:id').get(employeesController.getEmployee)

module.exports = router
