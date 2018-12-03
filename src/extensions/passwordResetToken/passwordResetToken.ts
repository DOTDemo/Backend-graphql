// Importing libraries
import { fromEvent } from 'graphcool-lib'
import * as bcrypt from 'bcryptjs'
import * as sgMail from '@sendgrid/mail';
import * as dotenv from 'dotenv';

// Environment Config
dotenv.config();

// SendGrid Environment Config
let sendKey: any = process.env.SENDGRID_API_KEY
sgMail.setApiKey(sendKey);

// Main Export Function 
const passwordResetToken = async (event: any) => {

    // Retrieve payload from event
    const { resetToken, email } = event.data.resetToken
    const newPassword = event.data.password

    // Graphcool-Lib Event and API  
    const graphcool = fromEvent(event)
    const api = graphcool.api('simple/v1')

    // Salt Rounds
    const saltRounds = 10

    // FetchUser Function with ResetToken
    const getUserWithToken = async (resetToken: any) => {
        return await api.request(`
         query {
            User(resetToken: "${resetToken}") {
            id
            resetExpires
            }
            }`)
            .then((userQueryResult: any) => {
                if (userQueryResult.error) {
                    return Promise.reject(userQueryResult.error)
                } else if (!userQueryResult.User || !userQueryResult.User.id || !userQueryResult.User.resetExpires) {
                    return Promise.reject('Not a valid token')
                } else {
                    return userQueryResult.User
                }
            })
    }

    // Update User Function for Password
    const updatePassword = async (id: any, newPasswordHash: any) => {
        return api.request(`
      mutation {
        updateUser(
          id: "${id}",
          password: "${newPasswordHash}",
          resetToken: null,
          resetExpires: null
        ) {
          id
        }
      }`)
        .then((userMutationResult: any) => (userMutationResult.updateUser.id))
    }

    return await getUserWithToken(resetToken)
        .then((graphcoolUser: any) => {
            // Retrieve payload from graphcoolUser
            const userId = graphcoolUser.id
            const resetExpires = graphcoolUser.resetExpires

            // Checking for Token Expiration
            if (new Date() > new Date(resetExpires)) {
                return Promise.reject('Token expired.')
            } else {
                return bcrypt.hash(newPassword, saltRounds)
                    .then((hash: any) => updatePassword(userId, hash))
                    .then((id: any) => ({ data: { id } }))
                    .catch((error: any) => ({ error: error.toString() }))
            }
        })
        // // Sending Mail confirmation for account password reset 
        // .then((graphcoolUser: any) => {
        //     if (graphcoolUser) {
        //         const sendMail: any = {
        //             to: email,
        //             from: process.env.EMAIL_ID,
        //             subject: 'Account Creation',
        //             text: `This is a confirmation for your account has just been created.`
        //         };
        //         let reSend: any = sgMail.send(sendMail)
        //         return reSend
        //     } else {
        //         return Promise.reject('Invalid Credentials')
        //     }
        // })
        .catch((error: any) => {
            console.log(error)
            return { error: 'An unexpected error occured.' }
        })
}
// Exporting Main Function
export default passwordResetToken;
