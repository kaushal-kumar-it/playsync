import { prisma } from "../db/prisma";
export async function saveUserIfNotExists(profile) {
    const  existing =await prisma.user.findUnique({
        where:{id:profile.uid}
    });
    if(!existing){
        await prisma.user.create({
            data:{
                id:profile.uid,
                name:profile.name,
                email:profile.email,

            },
        });
        console.log(`new user added to userbase ${profile.email}`);
    }
    
}