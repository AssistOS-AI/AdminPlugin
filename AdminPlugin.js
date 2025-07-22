const constants = require("../utils/constants.js");
const utils = require("../utils/apiUtils");
const process = require("process");

async function AdminPlugin() {
    let self = {};
    const persistence = await $$.loadPlugin("StandardPersistence");
    let emailPlugin = await $$.loadPlugin("EmailPlugin");
    const userLogger = await $$.loadPlugin("UserLoggerPlugin");


    self.getFounderId = async function () {
        let userStatus = await persistence.getUserLoginStatus(process.env.SYSADMIN_EMAIL);
        return userStatus.globalUserId;
    }
    self.getUserRole = async function (email) {
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
        let result = {allUsers: 0};
        for (let role of Object.values(constants.ROLES)) {
            let users = await persistence.getRoleGroupingByRole(role);
            result[role] = users.length;
            result.allUsers += users.length;
        }
        return result;
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

    async function extractUserLoginStatus(param) {
        if (!utils.validateEmail(param)) {
            let user = await persistence.getUser(param);
            param = user.email;

        }
        let userLoginStatus = await persistence.getUserLoginStatus(param);
        return userLoginStatus;
    }

    self.blockUser = async function (param, reason) {
        let userLoginStatus = await extractUserLoginStatus(param)
        userLoginStatus.blocked = true;
        await persistence.updateUserLoginStatus(userLoginStatus.id, userLoginStatus);
        let fromUserId = await self.getFounderId();
        emailPlugin.sendEmail(fromUserId, userLoginStatus.email, process.env.APP_SENDER_EMAIL, "Your Account Has Been Locked", reason, reason);

    }

    self.unblockUser = async function (param) {
        let userLoginStatus = await extractUserLoginStatus(param)
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

    async function createRoleGrouping() {
        let admins = await persistence.getRoleGroupingByRole(constants.ROLES.ADMIN);
        if (admins.length === 0) {
            let users = await persistence.getEveryUserLoginStatusObject();
            for (let user of users) {
                await persistence.updateUserLoginStatus(user.id, {role: user.role || constants.ROLES.USER});
            }
        }
    }

    self.getPublicMethods = function () {
        return [];
    }
    await createRoleGrouping();
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
                case "blockUser":
                case "unblockUser":
                case "deleteUser":
                case "setUserRole":
                    // can not do this for self
                    if (email === args[0]) {
                        return false
                    }
                    role = await singletonInstance.getUserRole(email);
                    if (!role) {
                        return false;
                    }
                    return role === constants.ROLES.ADMIN || role === constants.ROLES.MARKETING;

                case "getUsers":
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
        return ["StandardPersistence", "EmailPlugin", "UserLoggerPlugin"];
    }
}
