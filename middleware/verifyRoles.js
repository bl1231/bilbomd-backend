const verifyRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req?.roles) return res.sendStatus(401); // Unauthorized
        const rolesArray = [...allowedRoles];
        // Need to read up on these Higher Order Functions.
        const result = req.roles
            .map((role) => rolesArray.includes(role))
            .find((val) => val === true);
        if (!result) return res.sendStatus(401); // Unauthorized
        next();
    };
};

module.exports = verifyRoles;
