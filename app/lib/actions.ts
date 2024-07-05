'use server'

import {z} from 'zod'
import {sql} from '@vercel/postgres'
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
 
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
 
const FormSchema = z.object({

    id:z.string(),
    customerId:z.string({invalid_type_error:'Please select a customer.'
    }),
    amount:z.coerce.number().gt(0,{message:'Please enter an amount greater than 0'}),
    status:z.enum(['pending','paid'],{invalid_type_error:'Please select an invoice status'}),
    date:z.string(),
});
const CreateInvoice = FormSchema.omit({id:true,date:true,})
const UpdateInvoice = FormSchema.omit({id:true,date:true})
export async function authenticate(
    prevState: string| undefined,
    formData:FormData,
){
    try{
        await signIn('credentials',formData);
    }catch(error){
        if (error instanceof AuthError) {
            switch (error.type) {
              case 'CredentialsSignin':
                return 'Invalid credentials.';
              default:
                return 'Something went wrong.';
            }
        }
        throw error;
    }
}


export type State ={
    errors?:{
        customerId?:string[];
        amount?:string[];
        status?:string[];
    },
    message?:string|null;



}


export async function updateInvoice (id:string,prevState:State,formData:FormData){
    const rawFormDataForUpdate = {
        customerId:formData.get('customerId'),
        amount:formData.get('amount'),
        status:formData.get('status'),
    };
    const validationFields = UpdateInvoice.safeParse(rawFormDataForUpdate);
    if(!validationFields.success){
        return {
            errors: validationFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        }
    }
const {customerId,amount,status} = validationFields.data;
const amountInCents = amount*100;

try {
    await sql `UPDATE invoices SET customer_id = ${customerId}, amount = ${amountInCents},status =${status} WHERE id= ${id}`;
 
} catch (error) {

return {message:'unable to update invoices'}
}


revalidatePath('/dashboard/invoices')
redirect('/dashboard/invoices')

}

export const deleteInvoice = async (id:string)=>{
   // throw new Error('Failed to Delete Invoice');
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    } catch (error) {
        console.log(error)
   
    }

    //no need to redirect, only need to revalidate the path.
    revalidatePath('/dashboard/invoices');
}

export async function createInvoice(prevState:State, formData: FormData){
    console.log(prevState);
    const rawFormData = {


        customerId:formData.get('customerId'),
        amount:formData.get('amount'),
        status:formData.get('status'),
    };
    const validatedFields = CreateInvoice.safeParse(rawFormData)
    //if you do not do the checks, then you can not move on...
    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: 'Missing Fields. Failed to Create Invoice.',
        };
      }
    const {customerId,amount,status} = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    try {
        await sql`INSERT INTO invoices (customer_id,amount,status,date)    VALUES (${customerId}, ${amountInCents},${status}, ${date})`;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
          };
        }

    //revalidate the path and prefetch
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices')

//Test it out:
    console.log(rawFormData)
    console.log(typeof rawFormData.amount);

}



