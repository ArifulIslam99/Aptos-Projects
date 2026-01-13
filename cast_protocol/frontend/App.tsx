import React, { useState, useEffect, useRef } from 'react';
import { 
  Aptos, 
  AptosConfig, 
  Network,
  EphemeralKeyPair,
} from '@aptos-labs/ts-sdk';
import { jwtDecode } from 'jwt-decode';

// ==================== TYPES ====================
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

interface AccountInfo {
  exists: boolean;
  fullName?: string;
  subscriptionEnabled?: boolean;
  subscriberCount?: number;
  subscribedToCount?: number;
}

declare global {
  interface Window {
    google?: GoogleAccounts;
    aptos?: any;
  }
}

// ==================== CONFIG ====================
const APTOS_CONFIG = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(APTOS_CONFIG);
const GOOGLE_CLIENT_ID = '305427741136-j3j4r125hp5sqp5ojjdvcf5oomerckfn.apps.googleusercontent.com';
const MODULE_ADDRESS = '0xdfdda8374ca5e0dbe9fc21237c85295f120c7012c6344d96acf19d72a7236314';

// ==================== SIGN IN COMPONENT ====================
const SignInScreen: React.FC<{ onSignIn: (user: GoogleUser, account: KeylessAccountData) => void }> = ({ onSignIn }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ephemeralKeyPairRef = useRef<EphemeralKeyPair | null>(null);

  useEffect(() => {
    loadGoogleScript();
  }, []);

  const loadGoogleScript = () => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.head.appendChild(script);
  };

  const initializeGoogleSignIn = () => {
    if (!window.google) return;

    const ephemeral = EphemeralKeyPair.generate();
    ephemeralKeyPairRef.current = ephemeral;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      nonce: ephemeral.nonce,
    });

    const buttonDiv = document.getElementById('googleSignInButton');
    if (buttonDiv) {
      window.google.accounts.id.renderButton(buttonDiv, {
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 300
      });
    }
  };

  const handleGoogleCallback = async (response: GoogleCredentialResponse) => {
    setLoading(true);
    setError('');

    try {
      const jwt = response.credential;
      const payload = jwtDecode<JWTPayload>(jwt);
      
      const userData: GoogleUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
      };

      if (!ephemeralKeyPairRef.current) {
        throw new Error('Ephemeral key pair not generated');
      }

      const keylessAccountObj = await aptos.deriveKeylessAccount({
        jwt,
        ephemeralKeyPair: ephemeralKeyPairRef.current,
        uidKey: 'sub',
      });

      const accountData: KeylessAccountData = {
        address: keylessAccountObj.accountAddress.toString(),
        userData: userData,
      };

      localStorage.setItem('keyless_account', JSON.stringify(accountData));
      onSignIn(userData, accountData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Authentication failed: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '3rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem'
        }}>📺</div>
        
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          Welcome to Channelz
        </h1>
        
        <p style={{
          color: '#666',
          fontSize: '1.1rem',
          marginBottom: '2rem'
        }}>
          Create your decentralized channel on Aptos blockchain
        </p>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '12px',
            color: '#c33',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ color: '#666' }}>Authenticating...</div>
          </div>
        ) : (
          <>
            <div id="googleSignInButton" style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}></div>
            
            <p style={{
              fontSize: '0.9rem',
              color: '#999'
            }}>
              Powered by Aptos Keyless Authentication
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== PROFILE SIDEBAR ====================
const ProfileSidebar: React.FC<{
  user: GoogleUser;
  address: string;
  balance: string;
  onSignOut: () => void;
}> = ({ user, address, balance, onSignOut }) => {
  return (
    <div style={{
      width: '280px',
      background: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      height: 'fit-content',
      position: 'sticky',
      top: '2rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <img 
          src={user.picture} 
          alt={user.name}
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: '4px solid #667eea',
            marginBottom: '1rem'
          }}
        />
        <h3 style={{
          margin: '0 0 0.25rem 0',
          fontSize: '1.2rem',
          color: '#1a202c'
        }}>
          {user.name}
        </h3>
        <p style={{
          margin: 0,
          fontSize: '0.85rem',
          color: '#718096'
        }}>
          {user.email}
        </p>
      </div>

      <div style={{
        padding: '1rem',
        background: '#f7fafc',
        borderRadius: '12px',
        marginBottom: '1rem'
      }}>
        <div style={{
          fontSize: '0.75rem',
          color: '#718096',
          marginBottom: '0.5rem',
          fontWeight: '600'
        }}>
          APTOS ADDRESS
        </div>
        <div style={{
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          color: '#2d3748',
          wordBreak: 'break-all'
        }}>
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
      </div>

      <div style={{
        padding: '1rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        color: 'white'
      }}>
        <div style={{
          fontSize: '0.75rem',
          marginBottom: '0.5rem',
          opacity: 0.9
        }}>
          BALANCE
        </div>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          {balance} APT
        </div>
      </div>

      <button
        onClick={onSignOut}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#f56565',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: '600',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = '#e53e3e')}
        onMouseOut={(e) => (e.currentTarget.style.background = '#f56565')}
      >
        Sign Out
      </button>
    </div>
  );
};

// ==================== MAIN CONTENT AREA ====================
const MainContent: React.FC<{ address: string }> = ({ address }) => {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [channelName, setChannelName] = useState('');
  const [nameStatus, setNameStatus] = useState<{available: boolean; message: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAccountExists();
  }, [address]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (channelName.trim()) {
        checkNameAvailability(channelName);
      } else {
        setNameStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [channelName]);

  const checkAccountExists = async () => {
    setChecking(true);
    try {
      const exists = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::account::account_exists`,
          typeArguments: [],
          functionArguments: [address],
        },
      });

      if (exists[0]) {
        const info = await aptos.view({
          payload: {
            function: `${MODULE_ADDRESS}::account::get_account_info`,
            typeArguments: [],
            functionArguments: [address],
          },
        });
        
        setAccountInfo({
          exists: true,
          fullName: String(info[0] || ''),
          subscriptionEnabled: Boolean(info[1]),
          subscriberCount: Number(info[2]) || 0,
          subscribedToCount: Number(info[3]) || 0,
        });
      } else {
        setAccountInfo({ exists: false });
      }
    } catch (err) {
      console.error('Error checking account:', err);
      setAccountInfo({ exists: false });
    } finally {
      setChecking(false);
    }
  };

  const checkNameAvailability = async (name: string) => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${MODULE_ADDRESS}::account::query_name`,
          typeArguments: [],
          functionArguments: [name],
        },
      });
      
      const status = Number(result[0]);
      const messages = ['Name already taken', 'Name is blacklisted', 'Name is blocklisted', 'Available'];
      
      setNameStatus({
        available: status === 3,
        message: messages[status]
      });
    } catch (err) {
      setNameStatus({ available: false, message: 'Error checking name' });
    }
  };

  const handleCreateAccount = async () => {
    if (!channelName.trim() || !nameStatus?.available) return;

    setLoading(true);
    try {
      if (!window.aptos) {
        throw new Error('Petra wallet not found. Please install Petra wallet extension.');
      }

      const transaction = {
        data: {
          function: `${MODULE_ADDRESS}::account::create_account`,
          typeArguments: [],
          functionArguments: [channelName],
        },
      };

      const response = await window.aptos.signAndSubmitTransaction(transaction);
      await aptos.waitForTransaction({ transactionHash: response.hash });
      
      await checkAccountExists();
      setChannelName('');
      setNameStatus(null);
    } catch (err) {
      console.error('Account creation failed:', err);
      alert('Failed to create account: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <div style={{ color: '#718096' }}>Loading account information...</div>
        </div>
      </div>
    );
  }

  if (!accountInfo?.exists) {
    return (
      <div style={{
        flex: 1,
        background: 'white',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '2rem',
            color: '#1a202c',
            marginBottom: '0.5rem'
          }}>
            Create Your Channel
          </h2>
          <p style={{
            color: '#718096',
            marginBottom: '2rem'
          }}>
            Mint your Channelz NFT and create your account on the blockchain
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#2d3748',
              marginBottom: '0.5rem'
            }}>
              Channel Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Enter your channel name"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            
            {nameStatus && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                background: nameStatus.available ? '#f0fdf4' : '#fef2f2',
                color: nameStatus.available ? '#16a34a' : '#dc2626',
                border: `1px solid ${nameStatus.available ? '#bbf7d0' : '#fecaca'}`
              }}>
                {nameStatus.available ? '✅' : '❌'} {nameStatus.message}
              </div>
            )}
          </div>

          <button
            onClick={handleCreateAccount}
            disabled={loading || !channelName.trim() || !nameStatus?.available}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              background: (loading || !channelName.trim() || !nameStatus?.available)
                ? '#cbd5e0'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: (loading || !channelName.trim() || !nameStatus?.available) ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s'
            }}
            onMouseOver={(e) => {
              if (!loading && channelName.trim() && nameStatus?.available) {
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {loading ? '⏳ Creating Account...' : '🚀 Create Account (1 APT)'}
          </button>

          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#fffbeb',
            border: '1px solid #fde047',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#92400e'
          }}>
            <strong>💡 Note:</strong> Creating an account will mint a Channelz NFT and costs 1 APT.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      background: 'white',
      borderRadius: '16px',
      padding: '2rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{
        fontSize: '2rem',
        color: '#1a202c',
        marginBottom: '2rem'
      }}>
        Channel Dashboard
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem' }}>
            CHANNEL NAME
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {accountInfo.fullName}
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          background: '#f0fdf4',
          border: '2px solid #bbf7d0',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '0.5rem' }}>
            SUBSCRIBERS
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>
            {accountInfo.subscriberCount}
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          background: '#eff6ff',
          border: '2px solid #bfdbfe',
          borderRadius: '12px'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#1e40af', marginBottom: '0.5rem' }}>
            FOLLOWING
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>
            {accountInfo.subscribedToCount}
          </div>
        </div>
      </div>

      <div style={{
        padding: '1.5rem',
        background: accountInfo.subscriptionEnabled ? '#f0fdf4' : '#fef2f2',
        border: `2px solid ${accountInfo.subscriptionEnabled ? '#bbf7d0' : '#fecaca'}`,
        borderRadius: '12px'
      }}>
        <div style={{
          fontSize: '1rem',
          fontWeight: '600',
          color: accountInfo.subscriptionEnabled ? '#166534' : '#991b1b',
          marginBottom: '0.5rem'
        }}>
          Subscription Status
        </div>
        <div style={{
          color: accountInfo.subscriptionEnabled ? '#16a34a' : '#dc2626'
        }}>
          {accountInfo.subscriptionEnabled ? '✅ Enabled' : '❌ Disabled'}
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
function App() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [keylessAccount, setKeylessAccount] = useState<KeylessAccountData | null>(null);
  const [balance, setBalance] = useState('0.00');

  useEffect(() => {
    const savedAccount = localStorage.getItem('keyless_account');
    if (savedAccount) {
      try {
        const accountData: KeylessAccountData = JSON.parse(savedAccount);
        setKeylessAccount(accountData);
        setUser(accountData.userData);
      } catch (err) {
        localStorage.removeItem('keyless_account');
      }
    }
  }, []);

  useEffect(() => {
    if (keylessAccount?.address) {
      fetchBalance(keylessAccount.address);
    }
  }, [keylessAccount]);

  const fetchBalance = async (address: string) => {
    try {
      const resources = await aptos.getAccountResources({ accountAddress: address });
      const coinResource = resources.find((r: any) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      
      if (coinResource) {
        const balanceValue = (coinResource.data as any).coin.value;
        const aptBalance = (Number(balanceValue) / 100000000).toFixed(2);
        setBalance(aptBalance);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const handleSignIn = (userData: GoogleUser, accountData: KeylessAccountData) => {
    setUser(userData);
    setKeylessAccount(accountData);
  };

  const handleSignOut = () => {
    setUser(null);
    setKeylessAccount(null);
    localStorage.removeItem('keyless_account');
  };

  if (!user || !keylessAccount) {
    return <SignInScreen onSignIn={handleSignIn} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        gap: '2rem'
      }}>
        <ProfileSidebar 
          user={user}
          address={keylessAccount.address}
          balance={balance}
          onSignOut={handleSignOut}
        />
        <MainContent address={keylessAccount.address} />
      </div>
    </div>
  );
}

export default App;