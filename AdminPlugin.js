const constants = require("../utils/constants.js");
async function AdminPlugin() {
    let self = {};
    self.rewardUser = async function (user, referrerId) {
        return true;
    }
    const persistence = await $$.loadPlugin("StandardPersistence");

    self.getFounderId = async function () {
        let userStatus = await persistence.getUserLoginStatus(process.env.SYSADMIN_EMAIL);
        return userStatus.globalUserId;
    }
    self.getUserRole = async function (email) {
        if(!await persistence.hasUserLoginStatus(email)){
            return false;
        }
        let userStatus = await persistence.getUserLoginStatus(email);
        return userStatus.role || constants.ROLES.USER;
    }
    self.getRoles = async function () {
        return constants.ROLES;
    }
    self.getUsers = async function (offset = 0, limit = 10) {
        let allUsersIds = await persistence.getEveryUserLoginStatus();
        const usersIds = allUsersIds.slice(offset, offset + limit);
        let userList = [];
        for(let userId of usersIds){
            let user = await persistence.getUserLoginStatus(userId);
            userList.push({
                email: user.email,
                role: user.role || constants.ROLES.USER,
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
        if(!Object.values(constants.ROLES).includes(role)){
            throw new Error("Invalid role: " + role);
        }
        let userLoginStatus = await persistence.getUserLoginStatus(email);
        userLoginStatus.role = role;
        await persistence.updateUserLoginStatus(email, userLoginStatus);
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
        let users = await persistence.getEveryUserLoginStatusObject();
        let matchingUsers = [];
        for(let user of users){
            if(user.email.includes(input)){
                matchingUsers.push({
                    email: user.email,
                    blocked: user.blocked || false,
                    role: user.role || constants.ROLES.USER,
                    userInfo: user.userInfo,
                });
            }
        }
        matchingUsers = matchingUsers.slice(offset, offset + limit);
        return matchingUsers;
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
            switch (command){
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
                    if(!role){
                        return false;
                    }
                    return role === constants.ROLES.ADMIN || role === constants.ROLES.MARKETING;
                default:
                    return false;
            }
        }
    },
    getDependencies: function () {
        return ["StandardPersistence"];
    }
}
