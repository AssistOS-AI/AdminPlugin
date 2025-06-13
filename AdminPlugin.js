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
    self.isFounder = async function (userId) {
        if(!await persistence.hasUserLoginStatus(process.env.SYSADMIN_EMAIL)){
            return false;
        }
        let userStatus = await persistence.getUserLoginStatus(process.env.SYSADMIN_EMAIL);
        return userStatus.globalUserId === userId;
    }
    self.getUsers = async function (offset = 0, limit = 10) {
        let allUsersIds = await persistence.getEveryUserLoginStatus();
        const usersIds = allUsersIds.slice(offset, offset + limit);
        let userList = [];
        for(let userId of usersIds){
            let user = await persistence.getUserLoginStatus(userId);
            userList.push({
                email: user.email,
                role: user.role,
                blocked: user.blocked,
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
        await persistence.updateUserLoginStatus(userLoginStatus);
    }
    self.getMatchingUsers = async function (input) {
        let users = await persistence.getEveryUserLoginStatusObject();
        let matchingUsers = [];
        for(let user of users){
            if(user.email.includes(input)){
                matchingUsers.push({
                    email: user.email,
                    blocked: user.blocked,
                    role: user.role,
                    userInfo: user.userInfo,
                });
            }
        }
        return matchingUsers;
    }
    self.persistence = persistence;
    return self;
}

let singletonInstance = undefined;
async function getUserRole(email) {
    let userExists = await singletonInstance.persistence.hasUserLoginStatus(email);
    if(!userExists){
        return false;
    }
    let user = await singletonInstance.persistence.getUserLoginStatus(email);
    return user.role;
}

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
                case "isFounder":
                case "founderSpaceExists":
                case "rewardUser":
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
                case "deleteUser":
                case "setUserRole":
                case "getUsersCount":
                case "getMatchingUsers":
                    role = await getUserRole(email);
                    if(!role){
                        return false;
                    }
                    return role === constants.ROLES.ADMIN || role === constants.ROLES.SUPER_ADMIN;
                default:
                    return false;
            }
            return true;
        }
    },
    getDependencies: function () {
        return ["StandardPersistence"];
    }
}
