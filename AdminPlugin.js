const constants = require("../utils/constants.js");
async function AdminPlugin() {
    let self = {};
    self.rewardUser = async function (user, referrerId) {
        return true;
    }
    const persistence = await $$.loadPlugin("StandardPersistence");
    await persistence.configureTypes({
        ticket: {
            email: "string",
            subject: "string",
            message: "string",
            resolved: "boolean",
            resolutionMessage: "string",
        }
    });
    await persistence.createIndex("ticket", "subject");
    await persistence.createGrouping("tickets", "ticket", "resolved");
    await persistence.createGrouping("userTickets", "ticket", "email");
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
        let emails = await persistence.getEveryUserLoginStatusEmail();
        let matchingEmails = emails.filter(email => email.includes(input));
        matchingEmails = matchingEmails.slice(offset, offset + limit);

        let users = [];
        for(let email of matchingEmails){
            let user = await persistence.getUserLoginStatus(email);
            users.push({
                email: user.email,
                blocked: user.blocked || false,
                role: user.role || constants.ROLES.USER,
                userInfo: user.userInfo,
            });
        }
        return users;
    }

    self.createTicket = async function (email, subject, message) {
        await persistence.createTicket({
            email: email,
            subject: subject,
            message: message,
            resolved: false
        });
    }
    self.resolveTicket = async function (id, resolutionMessage) {
        let ticket = await persistence.getTicket(id);
        if (!ticket) {
            throw new Error("Ticket not found");
        }
        ticket.resolved = true;
        ticket.resolutionMessage = resolutionMessage;
        await persistence.updateTicket(id, ticket);
    }
    self.getTicketsCount = async function () {
        let tickets = await persistence.getEveryTicket();
        return tickets.length;
    }
    self.getUnresolvedTicketsCount = async function () {
        let tickets = await persistence.getTicketsByResolved(false);
        return tickets.length;
    }
    self.getTickets = async function (offset = 0, limit = 10) {
        let allTickets = await persistence.getEveryTicket();
        const ticketIds = allTickets.slice(offset, offset + limit);
        let ticketList = [];
        for (let ticketId of ticketIds) {
            let ticket = await persistence.getTicket(ticketId);
            ticketList.push({
                id: ticket.id,
                email: ticket.email,
                subject: ticket.subject,
                message: ticket.message,
                resolved: ticket.resolved,
                resolutionMessage: ticket.resolutionMessage || "",
            });
        }
        return ticketList;
    }
    self.getUserTickets = async function (email) {
        return await persistence.getUserTicketsObjectsByEmail(email);
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
                case "createTicket":
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
                case "resolveTicket":
                case "getTickets":
                case "getTicketsCount":
                case "getUnresolvedTicketsCount":
                    role = await singletonInstance.getUserRole(email);
                    if(!role){
                        return false;
                    }
                    return role === constants.ROLES.ADMIN || role === constants.ROLES.MARKETING;
                case "getUserTickets":
                    if(email === args[0]){
                        return true;
                    }
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
