const constants = require("../utils/constants.js");

async function AdminPlugin() {
    let self = {};
    const persistence = await $$.loadPlugin("StandardPersistence");
    const userLogger = await $$.loadPlugin("UserLoggerPlugin");


    self.getFounderId = async function () {
        let userStatus = await persistence.getUserLoginStatus(process.env.SYSADMIN_EMAIL);
        return userStatus.globalUserId;
    }
    self.getUserRole = async function (email) {
        if (process.env.SYSADMIN_EMAIL === email) {
            userStatus.role = constants.ROLES.ADMIN;
            return constants.ROLES.ADMIN;
        }
        if (!await persistence.hasUserLoginStatus(email)) {
            return false;
        }
        let userStatus = await persistence.getUserLoginStatus(email);


        console.log("User role is:", userStatus.role);
        return userStatus.role || constants.ROLES.USER;
    }
    self.getRoles = async function () {
        return constants.ROLES;
    }
    self.getUsers = async function (offset = 0, limit = 10) {
        let allUsersIds = await persistence.getEveryUserLoginStatus();
        const usersIds = allUsersIds.slice(offset, offset + limit);
        let userList = [];
        for (let userId of usersIds) {
            let user = await persistence.getUserLoginStatus(userId);
            const userRole = await self.getUserRole(user.email);
            userList.push({
                email: user.email,
                role: userRole,
                blocked: user.blocked || false,
                userInfo: user.userInfo,
            });
        }

        return userList;
    }

    self.getUsersCount = async function () {
        let users = await persistence.getEveryUserLoginStatus();
        return users.length;
    }
    self.setUserRole = async function (email, role) {
        if (!Object.values(constants.ROLES).includes(role)) {
            throw new Error("Invalid role: " + role);
        }
        let userLoginStatus = await persistence.getUserLoginStatus(email);
        let previousRole = await self.getUserRole(email);
        userLoginStatus.role = role;
        await persistence.updateUserLoginStatus(email, userLoginStatus);
        await userLogger.userLog(userLoginStatus.globalUserId, `Role changed from ${previousRole} to ${role}`);
    }
    self.deleteUser = async function (email) {
        let UserLogin = await $$.loadPlugin("UserLogin");
        await UserLogin.deleteUser(email);
    }
    self.blockUser = async function (email) {
        let userLoginStatus = await persistence.getUserLoginStatus(email);
        userLoginStatus.blocked = true;
        await persistence.updateUserLoginStatus(userLoginStatus.id, userLoginStatus);
    }
    self.unblockUser = async function (email) {
        let userLoginStatus = await persistence.getUserLoginStatus(email);
        userLoginStatus.blocked = false;
        await persistence.updateUserLoginStatus(userLoginStatus.id, userLoginStatus);
    }
    self.getMatchingUsers = async function (input, offset = 0, limit = 10) {
        let emails = await persistence.getEveryUserLoginStatusEmail();
        let matchingEmails = emails.filter(email => email.includes(input));
        matchingEmails = matchingEmails.slice(offset, offset + limit);

        let users = [];
        for (let email of matchingEmails) {
            let user = await persistence.getUserLoginStatus(email);
            const userRole = await self.getUserRole(email);
            users.push({
                email: user.email,
                blocked: user.blocked || false,
                role: userRole,
                userInfo: user.userInfo,
            });
        }
        return users;
    }
    self.persistence = persistence;
    return self;
}

let singletonInstance = undefined;

module.exports = {
    getInstance: async function () {
        if (!singletonInstance) {
            singletonInstance = await AdminPlugin();
        }
        return singletonInstance;
    },
    getAllow: function () {
        return async function (globalUserId, email, command, ...args) {
            let role;
            switch (command) {
                case "getUserRole":
                case "founderSpaceExists":
                case "rewardUser":
                case "getRoles":
                    return true;
                case "getFounderId":
                    // role = await getUserRole(email);
                    // if(!role){
                    //     return false;
                    // }
                    // return role === constants.ROLES.ADMIN;
                    return true;

                case "getUsers":
                case "blockUser":
                case "unblockUser":
                case "deleteUser":
                case "setUserRole":
                case "getUsersCount":
                case "getMatchingUsers":
                    role = await singletonInstance.getUserRole(email);
                    if (!role) {
                        return false;
                    }
                    return role === constants.ROLES.ADMIN || role === constants.ROLES.MARKETING;
                default:
                    return false;
            }
        }
    },
    getDependencies: function () {
        return ["StandardPersistence", "UserLoggerPlugin"];
    }
}
