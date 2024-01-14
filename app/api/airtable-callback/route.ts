import { cookies } from 'next/headers'


const storeTokens = (data: { access_token: any; refresh_token: any; expires_in: any; refresh_expires_in: any; }) => {
    const { access_token, refresh_token, expires_in, refresh_expires_in } = data;
    const accessTokenExpiry = new Date(new Date().getTime() + expires_in * 1000);
    const refreshTokenExpiry = new Date(new Date().getTime() + refresh_expires_in * 1000);

    console.log('access_token:', access_token);
    console.log('refresh_token:', refresh_token);

    // TODO: Figure out where to store the tokens? Cookie storage? DB?

    // localStorage.setItem('access_token', access_token);
    // localStorage.setItem('refresh_token', refresh_token);
    // localStorage.setItem('access_token_expiry', accessTokenExpiry.toString());
    // localStorage.setItem('refresh_token_expiry', refreshTokenExpiry.toString());
};


const exchangeCodeForTokens = async (code: string) => {
    const cookieStore = cookies()
    const codeVerifierCookie = cookieStore.get('code_verifier');

    if (codeVerifierCookie === undefined) {
        // TODO: Handle this error
        console.error('Code verifier not found');
        return;
    }

    const  codeVerifier = codeVerifierCookie.value;

    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: '35052bb5-755f-4533-a69c-60b1a3f7779d',
      redirect_uri: 'http://localhost:3000/api/airtable-callback',
      code_verifier: codeVerifier, // Include the code verifier here
    });  

    try {
        const response = await fetch('https://airtable.com/oauth2/v1/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });

        const data = await response.json();
        console.log(data);
        storeTokens(data);
    } catch (error) {
        console.error('Token exchange error:', error);
    }
};

export async function GET(req: Request) {
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
        await exchangeCodeForTokens(code);
    }

    return Response.redirect('http://localhost:3000/');
}
