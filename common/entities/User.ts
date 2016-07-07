export enum UserRoles{
    Guest = 1,
    User = 2,
    Admin = 3,
    Developer = 4,

}

export class User {
    public id:number;

    constructor(public name?:string, public password?:string, public role:UserRoles = UserRoles.User) {
    }
}