import { useState, useEffect, useRef } from 'react';
import { 
  Aptos, 
  AptosConfig, 
  Network,
  EphemeralKeyPair,
  KeylessAccount,
} from '@aptos-labs/ts-sdk';
import { jwtDecode } from 'jwt-decode';

// Type definitions for Google Sign-In
interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: GoogleIdConfiguration) => void;
      renderButton: (parent: HTMLElement, options: GsiButtonConfiguration) => void;
      disableAutoSelect: () => void;
    };
  };
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
}

interface GsiButtonConfiguration {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
}

interface JWTPayload {
  iss: string;
  sub: string;
  email: string;
  name: string;
  picture: string;
  aud: string;
  exp: number;
  iat: number;
}

interface KeylessAccountData {
  address: string;
  userData: GoogleUser;
}

// Extend Window interface
declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

// Configuration
const APTOS_CONFIG = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(APTOS_CONFIG);

// IMPORTANT: Replace with your Google OAuth Client ID
const GOOGLE_CLIENT_ID = '305427741136-j3j4r125hp5sqp5ojjdvcf5oomerckfn.apps.googleusercontent.com';

function App() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [keylessAccount, setKeylessAccount] = useState<KeylessAccountData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Use ref instead of state to avoid timing issues
  const ephemeralKeyPairRef = useRef<EphemeralKeyPair | null>(null);

  // Initialize Google Sign-In on component mount
  useEffect(() => {
    loadGoogleScript();
    
    // Check if user was previously logged in
    const savedAccount = localStorage.getItem('keyless_account');
    if (savedAccount) {
      try {
        const accountData: KeylessAccountData = JSON.parse(savedAccount);
        setKeylessAccount(accountData);
        setUser(accountData.userData);
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('keyless_account');
      }
    }
  }, []);

  // Load Google Sign-In script
  const loadGoogleScript = (): void => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.head.appendChild(script);
  };

  // Initialize Google Sign-In
  const initializeGoogleSignIn = (): void => {
    if (!window.google) return;

    // Generate ephemeral key pair and store in ref
    const ephemeral = EphemeralKeyPair.generate();
    ephemeralKeyPairRef.current = ephemeral;
    
    console.log('Ephemeral key pair generated:', ephemeral);
    console.log('Nonce:', ephemeral.nonce);

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      nonce: ephemeral.nonce,
    });

    const buttonDiv = document.getElementById('googleSignInButton');
    if (buttonDiv) {
      window.google.accounts.id.renderButton(
        buttonDiv,
        {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 280
        }
      );
    }
  };

  // Handle Google Sign-In callback
  const handleGoogleCallback = async (response: GoogleCredentialResponse): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const jwt = response.credential;
      
      console.log('=== Google Sign-In Callback ===');
      console.log('JWT received:', jwt.substring(0, 50) + '...');
      console.log('Ephemeral key pair exists:', !!ephemeralKeyPairRef.current);
      
      // Decode JWT to get user info
      const payload = jwtDecode<JWTPayload>(jwt);
      const userData: GoogleUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
      };

      console.log('User data decoded:', userData);

      // Create Keyless Account
      const keylessAccountObj = await createKeylessAccount(jwt);
      
      const accountData: KeylessAccountData = {
        address: keylessAccountObj.accountAddress.toString(),
        userData: userData,
      };

      setUser(userData);
      setKeylessAccount(accountData);

      // Save to localStorage for persistence
      localStorage.setItem('keyless_account', JSON.stringify(accountData));

      console.log('✅ Keyless Account Created Successfully!');
      console.log('Account Address:', keylessAccountObj.accountAddress.toString());
      
    } catch (err) {
      console.error('❌ Keyless account creation failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to create Keyless account: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Create Keyless Account from JWT
  const createKeylessAccount = async (jwt: string): Promise<KeylessAccount> => {
    console.log('=== Creating Keyless Account ===');
    
    // Check if ephemeral key pair exists
    if (!ephemeralKeyPairRef.current) {
      console.error('❌ Ephemeral key pair is null!');
      throw new Error('Ephemeral key pair not generated. Please refresh and try again.');
    }

    console.log('✅ Ephemeral key pair exists');

    try {
      // Decode JWT to get iss (issuer)
      const payload = jwtDecode<JWTPayload>(jwt);
      console.log('JWT Issuer:', payload.iss);
      console.log('JWT Subject:', payload.sub);

      // Derive Keyless Account
      console.log('Calling aptos.deriveKeylessAccount...');
      const keylessAccount = await aptos.deriveKeylessAccount({
        jwt,
        ephemeralKeyPair: ephemeralKeyPairRef.current,
        uidKey: 'sub',
      });

      console.log('✅ Keyless account derived successfully');
      return keylessAccount;
      
    } catch (err) {
      console.error('❌ Error in createKeylessAccount:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error('Failed to derive keyless account: ' + errorMessage);
    }
  };

  // Sign out
  const handleSignOut = (): void => {
    setUser(null);
    setKeylessAccount(null);
    ephemeralKeyPairRef.current = null;
    localStorage.removeItem('keyless_account');
    window.google?.accounts.id.disableAutoSelect();
    
    // Reinitialize for next sign-in
    setTimeout(() => {
      initializeGoogleSignIn();
    }, 100);
  };

  // Copy address to clipboard
  const copyAddress = (): void => {
    if (keylessAccount?.address) {
      navigator.clipboard.writeText(keylessAccount.address);
      alert('Address copied to clipboard!');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        padding: '2.5rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            🔐 Aptos Keyless Auth
          </h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>
            Sign in with Google - No wallet needed!
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c33',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{
            padding: '1.5rem',
            background: '#f0f0f0',
            borderRadius: '12px',
            textAlign: 'center',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <div style={{ color: '#666' }}>Creating your Keyless account...</div>
            <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              This may take a few seconds...
            </div>
          </div>
        )}

        {/* Not Signed In */}
        {!user && !loading && (
          <div>
            <div style={{
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              <p style={{ 
                marginBottom: '1.5rem', 
                color: '#666',
                fontSize: '1rem'
              }}>
                Click the button below to sign in with your Google account
              </p>
              
              <div id="googleSignInButton" style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '2rem'
              }}></div>
            </div>

            {/* Info Box */}
            <div style={{
              padding: '1.5rem',
              background: '#f8f9ff',
              border: '2px solid #e0e7ff',
              borderRadius: '12px',
              fontSize: '0.9rem',
              color: '#4338ca'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', fontSize: '1rem' }}>
                🌟 What is Aptos Keyless?
              </div>
              <ul style={{ 
                margin: 0, 
                paddingLeft: '1.5rem',
                lineHeight: '1.8'
              }}>
                <li>No browser extension needed</li>
                <li>No seed phrases to remember</li>
                <li>Sign in with your Google account</li>
                <li>Your account is secured by OpenID Connect</li>
                <li>Works on any device instantly</li>
              </ul>
            </div>

            {/* Debug Info */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#666',
              fontFamily: 'monospace'
            }}>
              <strong>Debug Info:</strong><br/>
              Ephemeral Key Pair: {ephemeralKeyPairRef.current ? '✅ Generated' : '❌ Not Generated'}<br/>
              Network: Devnet
            </div>
          </div>
        )}

        {/* Signed In */}
        {user && keylessAccount && (
          <div>
            {/* User Profile */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              border: '2px solid #0ea5e9'
            }}>
              <img 
                src={user.picture} 
                alt={user.name}
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  border: '3px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '1.2rem',
                  color: '#0c4a6e',
                  marginBottom: '0.25rem'
                }}>
                  {user.name}
                </div>
                <div style={{ 
                  color: '#0369a1', 
                  fontSize: '0.9rem' 
                }}>
                  {user.email}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#dc2626')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#ef4444')}
              >
                Sign Out
              </button>
            </div>

            {/* Keyless Account Info */}
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                fontWeight: 'bold',
                color: '#92400e',
                marginBottom: '1rem',
                fontSize: '1.1rem'
              }}>
                ✅ Keyless Account Created!
              </div>
              
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: '#78350f',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>
                  Your Aptos Address:
                </div>
                <div style={{
                  background: 'white',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  wordBreak: 'break-all',
                  color: '#1e293b',
                  border: '1px solid #fbbf24'
                }}>
                  {keylessAccount.address}
                </div>
              </div>

              <button
                onClick={copyAddress}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#d97706')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#f59e0b')}
              >
                📋 Copy Address
              </button>
            </div>

            {/* Success Info */}
            <div style={{
              padding: '1.5rem',
              background: '#dcfce7',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              fontSize: '0.9rem',
              color: '#166534'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.75rem' }}>
                🎉 Authentication Successful!
              </div>
              <div style={{ lineHeight: '1.6' }}>
                You now have a blockchain account secured by your Google login. 
                No private keys to manage, no seed phrases to remember. 
                Your account is ready to use with any Aptos dApp!
              </div>
            </div>

            {/* Network Info */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#f1f5f9',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#475569',
              textAlign: 'center'
            }}>
              <strong>Network:</strong> Aptos Devnet
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;