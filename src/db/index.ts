import colors from "colors";
import { Sequelize } from "sequelize";

import { User } from "./Schema/User.js";

const sequelize = new Sequelize("mysql://3NpFRM3HtHiE3ZX.root:emBpqpqfgYNXsm5q@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/helixai_db", {
    dialect: "mysql",
    dialectOptions: {
        ssl: {
            rejectUnauthorized: true
        }
    }
});

try {
    await sequelize.authenticate();
    console.log(colors.green("Database connection established successfully."));

    await sequelize.sync();
    console.log(colors.green('All models were synchronized successfully.'));
} catch (error) {
    console.error(colors.red(`Unable to connect to the database: ${JSON.stringify(error)}`));
}

export { sequelize };