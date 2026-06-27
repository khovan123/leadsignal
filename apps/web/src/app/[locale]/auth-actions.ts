'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';

const apiUrl=process.env.INTERNAL_API_URL??process.env.NEXT_PUBLIC_API_URL??'http://localhost:4000';

type Session={accessToken:string;refreshToken:string;expiresIn:number;user:{id:string;email:string;displayName:string;workspaceId?:string}};

async function saveSession(session:Session){const store=await cookies();const secure=process.env.NODE_ENV==='production';store.set('ls_access',session.accessToken,{httpOnly:true,sameSite:'lax',secure,path:'/',maxAge:session.expiresIn});store.set('ls_refresh',session.refreshToken,{httpOnly:true,sameSite:'lax',secure,path:'/',maxAge:Number(process.env.JWT_REFRESH_TTL_DAYS??30)*86400});if(session.user.workspaceId)store.set('ls_workspace',session.user.workspaceId,{httpOnly:true,sameSite:'lax',secure,path:'/',maxAge:Number(process.env.JWT_REFRESH_TTL_DAYS??30)*86400});}

async function authenticate(endpoint:string,payload:Record<string,string>,locale:string){const response=await fetch(`${apiUrl}/api/auth/${endpoint}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});if(!response.ok){const message=encodeURIComponent((await response.text()).slice(0,300));redirect(`/${locale}/${endpoint==='login'?'login':'register'}?error=${message}`);}await saveSession(await response.json() as Session);redirect(`/${locale}`);}

export async function loginAction(formData:FormData){const locale=String(formData.get('locale')??'vi');return authenticate('login',{email:String(formData.get('email')??''),password:String(formData.get('password')??'')},locale);}

export async function registerAction(formData:FormData){const locale=String(formData.get('locale')??'vi');return authenticate('register',{email:String(formData.get('email')??''),displayName:String(formData.get('displayName')??''),password:String(formData.get('password')??'')},locale);}

export async function logoutAction(formData:FormData){const locale=String(formData.get('locale')??'vi');const store=await cookies();const access=store.get('ls_access')?.value;if(access)await fetch(`${apiUrl}/api/auth/logout`,{method:'POST',headers:{authorization:`Bearer ${access}`},cache:'no-store'}).catch(()=>undefined);store.delete('ls_access');store.delete('ls_refresh');store.delete('ls_workspace');redirect(`/${locale}/login`);}

export async function acceptInvitationAction(formData:FormData){const locale=String(formData.get('locale')??'vi');const token=String(formData.get('token')??'');const result=await api<{workspaceId:string}>('/invitations/accept',{method:'POST',body:JSON.stringify({token})});(await cookies()).set('ls_workspace',result.workspaceId,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:Number(process.env.JWT_REFRESH_TTL_DAYS??30)*86400});redirect(`/${locale}`);}
