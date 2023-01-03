const express = require('express');
const router = express.Router();
const path = require('path');
const employeeController = require('../../controllers/employeeController');


router.route('/')
    .get(employeeController.getAllEmployees)
    .post(employeeController.createNewEmployee)
    .put(employeeController.updateEmployee)
    .delete(employeeController.deleteEmployee);

router.route("/:id")
    .get(employeeController.getEmployee);

console.log('employee\trouter loaded');
module.exports = router;