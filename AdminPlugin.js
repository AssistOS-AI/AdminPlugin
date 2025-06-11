const roles = {
    "ADMIN": "admin",
    "MARKETING": "marketing",
    "USER": "user"
}
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

    self.getRegisteredUsers = async function (timestamp) {

    }
    self.getRegisteredUsersCount = async function () {
        let users = await persistence.getEveryUserLoginStatus();
        return users.length;
    }
    self.setUserRole = async function (email, role) {
        if(!Object.values(roles).includes(role)){
            throw new Error("Invalid role: " + role);
        }
        let userLoginStatus = await persistence.getUserLoginStatus(email);
        userLoginStatus.role = role;
        await persistence.updateUserLoginStatus(userLoginStatus);
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
            // let role;
            // switch (command){
            //     case "isFounder":
            //     case "founderSpaceExists":
            //     case "rewardUser":
            //         return true;
            //     case "getFounderId":
            //         return args[0] === process.env.SERVERLESS_AUTH_SECRET;
            //
            //     default:
            //         return false;
            // }
            return true;
        }
    },
    getDependencies: function () {
        return ["StandardPersistence"];
    }
}
