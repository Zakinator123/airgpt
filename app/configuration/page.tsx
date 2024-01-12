'use client'

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(36)).join('');
  }
  
  function sha256(buffer) {
    return crypto.subtle.digest('SHA-256', buffer);
  }
  
  function base64urlencode(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  
  async function generateCodeChallenge(codeVerifier) {
    const hashed = await sha256(new TextEncoder().encode(codeVerifier));
    return base64urlencode(hashed);
  }
  


export default async function ConfigPage() {
    const startOAuth = async () => {
        const clientId = '35052bb5-755f-4533-a69c-60b1a3f7779d';
        const redirectUri = encodeURIComponent('http://localhost:3000/airtable-callback');
        const scope = encodeURIComponent('data.records:read schema.bases:read');
        const state = generateRandomString();
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
      
        localStorage.setItem('code_verifier', codeVerifier); // Save the code verifier for later
      
        const authUrl = `https://airtable.com/oauth2/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
        window.location.href = authUrl;
      };
      

    return <button onClick={startOAuth}>Configure</button>;
}


// TODO: Implement a better random generator
function generateRandomString() {
    return Math.random() + 'string';
}