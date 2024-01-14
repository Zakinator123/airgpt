import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import * as crypto from 'crypto';

// Server Component
export default function ConfigPage() {
  // Server Action
  async function create() {
    'use server'

    function generateCodeVerifier(): string {
      const array = new Uint8Array(32);
      crypto.randomFillSync(array);
      return Array.from(array, (b) => b.toString(36)).join('');
    }

    async function sha256(buffer: Buffer): Promise<Buffer> {
      return crypto.createHash('sha256').update(buffer).digest();
    }

    function base64urlencode(a: Buffer): string {
      return a.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    async function generateCodeChallenge(codeVerifier: string): Promise<string> {
      const hashed = await sha256(Buffer.from(codeVerifier));
      return base64urlencode(hashed);
    }

    function generateRandomString(): string {
      return crypto.randomBytes(16).toString('hex');
    }

    const clientId = '35052bb5-755f-4533-a69c-60b1a3f7779d';
    const redirectUri = encodeURIComponent('http://localhost:3000/api/airtable-callback');
    const scope = encodeURIComponent('data.records:read schema.bases:read');
    const state = generateRandomString();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    cookies().set('code_verifier', codeVerifier)

    const authUrl = `https://airtable.com/oauth2/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    redirect(authUrl);
  };

  return <form action={create}><button type='submit'>Configure</button></form>;
}



// export default async function ConfigPage() {
//     const startOAuth = async () => {
//         const clientId = '35052bb5-755f-4533-a69c-60b1a3f7779d';
//         const redirectUri = encodeURIComponent('http://localhost:3000/airtable-callback');
//         const scope = encodeURIComponent('data.records:read schema.bases:read');
//         const state = generateRandomString();
//         const codeVerifier = generateCodeVerifier();
//         const codeChallenge = await generateCodeChallenge(codeVerifier);

//         localStorage.setItem('code_verifier', codeVerifier); // Save the code verifier for later

//         const authUrl = `https://airtable.com/oauth2/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
//         window.location.href = authUrl;
//       };


//     return <button onClick={startOAuth}>Configure</button>;
// }