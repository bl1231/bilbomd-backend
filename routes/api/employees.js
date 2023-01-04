const express = require('express');
const router = express.Router();
const path = require('path');
const employeeController = require('../../controllers/employeeController');
const ROLES_LIST = require('../../config/roles_list');
const verifyRoles = require('../../middleware/verifyRoles');

router.route('/')
    .get(employeeController.getAllEmployees)
    .post(verifyRoles(ROLES_LIST.Admin, ROLES_LIST.Editor), employeeController.createNewEmployee)
    .put(verifyRoles(ROLES_LIST.Admin, ROLES_LIST.Editor),employeeController.updateEmployee)
    .delete(verifyRoles(ROLES_LIST.Admin),employeeController.deleteEmployee);

router.route("/:id")
    .get(employeeController.getEmployee);

console.log('employee\trouter loaded');
module.exports = router;