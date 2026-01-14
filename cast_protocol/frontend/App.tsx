import React, { useState, useEffect, useRef } from 'react';
import {
  Aptos,
  AptosConfig,
  Network,
  EphemeralKeyPair,
  KeylessAccount,
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
const SignInScreen: React.FC<{ onSignIn: (user: GoogleUser, account: KeylessAccountData, keylessAccount: KeylessAccount) => void }> = ({ onSignIn }) => {
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
      onSignIn(userData, accountData, keylessAccountObj);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Authentication failed: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '3rem', maxWidth: '500px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📺</div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem' }}>Welcome to Channelz</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '2rem' }}>Create your decentralized channel on Aptos blockchain</p>

        {error && (
          <div style={{ padding: '1rem', background: '#fee', border: '1px solid #fcc', borderRadius: '12px', color: '#c33', marginBottom: '1.5rem', fontSize: '0.9rem' }}>⚠️ {error}</div>
        )}

        {loading ? (
          <div style={{ padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ color: '#666' }}>Authenticating...</div>
          </div>
        ) : (
          <>
            <div id="googleSignInButton" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}></div>
            <p style={{ fontSize: '0.9rem', color: '#999' }}>Powered by Aptos Keyless Authentication</p>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== PROFILE SIDEBAR ====================
const ProfileSidebar: React.FC<{ user: GoogleUser; address: string; balance: string; onSignOut: () => void }> = ({ user, address, balance, onSignOut }) => {
  return (
    <div style={{ width: '280px', background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', height: 'fit-content', position: 'sticky', top: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={user.picture} alt={user.name} style={{ width: '100px', height: '100px', borderRadius: '50%', border: '4px solid #667eea', marginBottom: '1rem' }} />
        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#1a202c' }}>{user.name}</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#718096' }}>{user.email}</p>
      </div>

      <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '12px', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.5rem', fontWeight: '600' }}>APTOS ADDRESS</div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#2d3748', wordBreak: 'break-all' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
            <button onClick={() => navigator.clipboard.writeText(address)} style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Copy</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', marginBottom: '1.5rem', color: 'white' }}>
        <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.9 }}>BALANCE</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{balance} APT</div>
      </div>

      <button onClick={onSignOut} style={{ width: '100%', padding: '0.75rem', background: '#f56565', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>Sign Out</button>
    </div>
  );
};

// ==================== CONGRATULATIONS MODAL ====================
const CongratulationsModal: React.FC<{ channelName: string; onClose: () => void }> = ({ channelName, onClose }) => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.3s ease-out' }}>
      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
          @keyframes confetti { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(400px) rotate(720deg); opacity: 0; } }
          @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        `}
      </style>

      {[...Array(20)].map((_, i) => (
        <div key={i} style={{ position: 'absolute', top: '-20px', left: `${Math.random() * 100}%`, width: '10px', height: '10px', background: ['#667eea', '#764ba2', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'][i % 6], borderRadius: i % 2 === 0 ? '50%' : '2px', animation: `confetti ${2 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards` }} />
      ))}

      <div style={{ background: 'white', borderRadius: '24px', padding: '3rem', maxWidth: '500px', width: '90%', textAlign: 'center', animation: 'scaleIn 0.5s ease-out', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmer 2s infinite', pointerEvents: 'none' }} />

        <div style={{ fontSize: '5rem', marginBottom: '1rem', animation: 'bounce 1s ease-in-out infinite' }}>🎉</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}>Congratulations!</h1>
        <p style={{ fontSize: '1.2rem', color: '#4a5568', marginBottom: '0.5rem' }}>You are now onboard to the</p>
        <p style={{ fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '1rem' }}>Channelz World! 📺</p>

        <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', color: 'white', marginBottom: '1.5rem', animation: 'pulse 2s ease-in-out infinite' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.25rem' }}>Your Channel</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{channelName}</div>
        </div>

        <p style={{ fontSize: '0.95rem', color: '#718096', marginBottom: '1.5rem' }}>Your Channelz NFT has been minted! 🎨<br />Start subscribing to other channels and build your community.</p>

        <button onClick={onClose} style={{ padding: '1rem 3rem', fontSize: '1.1rem', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '50px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)' }}>🚀 Let's Go!</button>
      </div>
    </div>
  );
};

// ==================== MAIN CONTENT AREA ====================
const MainContent: React.FC<{ address: string; keylessAccount: KeylessAccount | null }> = ({ address, keylessAccount }) => {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [channelName, setChannelName] = useState('');
  const [nameStatus, setNameStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showCongrats, setShowCongrats] = useState(false);
  const [createdChannelName, setCreatedChannelName] = useState('');
  const [subscribeAddress, setSubscribeAddress] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeStatus, setSubscribeStatus] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => { checkAccountExists(); }, [address]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (channelName.trim()) { checkNameAvailability(channelName); } else { setNameStatus(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [channelName]);

  const checkAccountExists = async () => {
    setChecking(true);
    try {
      const exists = await aptos.view({ payload: { function: `${MODULE_ADDRESS}::account::account_exists`, typeArguments: [], functionArguments: [address] } });
      if (exists[0]) {
        const info = await aptos.view({ payload: { function: `${MODULE_ADDRESS}::account::get_account_info`, typeArguments: [], functionArguments: [address] } });
        setAccountInfo({ exists: true, fullName: String(info[0] || ''), subscriptionEnabled: Boolean(info[1]), subscriberCount: Number(info[2]) || 0, subscribedToCount: Number(info[3]) || 0 });
      } else { setAccountInfo({ exists: false }); }
    } catch (err) { console.error('Error checking account:', err); setAccountInfo({ exists: false }); }
    finally { setChecking(false); }
  };

  const checkNameAvailability = async (name: string) => {
    try {
      const result = await aptos.view({ payload: { function: `${MODULE_ADDRESS}::account::query_name`, typeArguments: [], functionArguments: [name] } });
      const status = Number(result[0]);
      const messages = ['Name already taken', 'Name is blacklisted', 'Name is blocklisted', 'Available'];
      setNameStatus({ available: status === 3, message: messages[status] });
    } catch (err) { setNameStatus({ available: false, message: 'Error checking name' }); }
  };

  const handleCreateAccount = async () => {
    if (!channelName.trim() || !nameStatus?.available) return;
    setLoading(true);
    try {
      if (!keylessAccount) throw new Error('Keyless account not available. Please sign in again.');
      const transaction = await aptos.transaction.build.simple({ sender: keylessAccount.accountAddress, data: { function: `${MODULE_ADDRESS}::account::create_account`, typeArguments: [], functionArguments: [channelName] } });
      const committedTxn = await aptos.signAndSubmitTransaction({ signer: keylessAccount, transaction });
      await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
      setCreatedChannelName(channelName);
      setShowCongrats(true);
      await checkAccountExists();
      setChannelName('');
      setNameStatus(null);
    } catch (err) { console.error('Account creation failed:', err); alert('Failed to create account: ' + (err instanceof Error ? err.message : 'Unknown error')); }
    finally { setLoading(false); }
  };

  const handleSubscribe = async () => {
    if (!subscribeAddress.trim()) return;
    setSubscribing(true);
    setSubscribeStatus(null);
    try {
      if (!keylessAccount) throw new Error('Keyless account not available. Please sign in again.');
      if (!subscribeAddress.startsWith('0x') || subscribeAddress.length < 10) throw new Error('Invalid wallet address format');
      const targetExists = await aptos.view({ payload: { function: `${MODULE_ADDRESS}::account::account_exists`, typeArguments: [], functionArguments: [subscribeAddress] } });
      if (!targetExists[0]) throw new Error('Target account does not exist on Channelz');
      const transaction = await aptos.transaction.build.simple({ sender: keylessAccount.accountAddress, data: { function: `${MODULE_ADDRESS}::account::subscribe`, typeArguments: [], functionArguments: [subscribeAddress] } });
      const committedTxn = await aptos.signAndSubmitTransaction({ signer: keylessAccount, transaction });
      await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
      setSubscribeStatus({ success: true, message: 'Successfully subscribed!' });
      setSubscribeAddress('');
      await checkAccountExists();
    } catch (err: any) {
      console.error('Subscribe failed:', err);
      let errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('E_CANNOT_SUBSCRIBE_TO_SELF') || errorMessage.includes('0x6')) errorMessage = 'You cannot subscribe to yourself';
      else if (errorMessage.includes('E_ACCOUNT_NOT_FOUND') || errorMessage.includes('0x5')) errorMessage = 'Account not found on Channelz';
      else if (errorMessage.includes('E_SUBSCRIPTION_DISABLED') || errorMessage.includes('0x3')) errorMessage = 'This account has disabled subscriptions';
      setSubscribeStatus({ success: false, message: errorMessage });
    } finally { setSubscribing(false); }
  };

  if (checking) {
    return (
      <>
        {showCongrats && <CongratulationsModal channelName={createdChannelName} onClose={() => setShowCongrats(false)} />}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ color: '#718096' }}>Loading account information...</div>
          </div>
        </div>
      </>
    );
  }

  if (!accountInfo?.exists) {
    return (
      <>
        {showCongrats && <CongratulationsModal channelName={createdChannelName} onClose={() => setShowCongrats(false)} />}
        <div style={{ flex: 1, background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2rem', color: '#1a202c', marginBottom: '0.5rem' }}>Create Your Channel</h2>
            <p style={{ color: '#718096', marginBottom: '2rem' }}>Mint your Channelz NFT and create your account on the blockchain</p>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', color: '#2d3748', marginBottom: '0.5rem' }}>Channel Name</label>
              <input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Enter your channel name" style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', outline: 'none' }} onFocus={(e) => e.target.style.borderColor = '#667eea'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'} />
              {nameStatus && <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', background: nameStatus.available ? '#f0fdf4' : '#fef2f2', color: nameStatus.available ? '#16a34a' : '#dc2626', border: `1px solid ${nameStatus.available ? '#bbf7d0' : '#fecaca'}` }}>{nameStatus.available ? '✅' : '❌'} {nameStatus.message}</div>}
            </div>
            <button onClick={handleCreateAccount} disabled={loading || !channelName.trim() || !nameStatus?.available} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', background: (loading || !channelName.trim() || !nameStatus?.available) ? '#cbd5e0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: (loading || !channelName.trim() || !nameStatus?.available) ? 'not-allowed' : 'pointer' }}>{loading ? '⏳ Creating Account...' : '🚀 Create Account (1 APT)'}</button>
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fde047', borderRadius: '8px', fontSize: '0.85rem', color: '#92400e' }}><strong>💡 Note:</strong> Creating an account will mint a Channelz NFT and costs 1 APT.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {showCongrats && <CongratulationsModal channelName={createdChannelName} onClose={() => setShowCongrats(false)} />}
      <div style={{ flex: 1, background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '2rem', color: '#1a202c', marginBottom: '2rem' }}>Channel Dashboard</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', color: 'white' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginBottom: '0.5rem' }}>CHANNEL NAME</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{accountInfo?.fullName}</div>
          </div>
          <div style={{ padding: '1.5rem', background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '0.5rem' }}>SUBSCRIBERS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>{accountInfo?.subscriberCount}</div>
          </div>
          <div style={{ padding: '1.5rem', background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.85rem', color: '#1e40af', marginBottom: '0.5rem' }}>FOLLOWING</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>{accountInfo?.subscribedToCount}</div>
          </div>
        </div>
        <div style={{ padding: '1.5rem', background: accountInfo?.subscriptionEnabled ? '#f0fdf4' : '#fef2f2', border: `2px solid ${accountInfo?.subscriptionEnabled ? '#bbf7d0' : '#fecaca'}`, borderRadius: '12px' }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: accountInfo?.subscriptionEnabled ? '#166534' : '#991b1b', marginBottom: '0.5rem' }}>Subscription Status</div>
          <div style={{ color: accountInfo?.subscriptionEnabled ? '#16a34a' : '#dc2626' }}>{accountInfo?.subscriptionEnabled ? '✅ Enabled' : '❌ Disabled'}</div>
        </div>
        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: '2px solid #7dd3fc', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0369a1', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🔔 Subscribe to a Channel</h3>
          <p style={{ fontSize: '0.9rem', color: '#0c4a6e', marginBottom: '1rem' }}>Enter the wallet address of the channel you want to subscribe to:</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            <input type="text" value={subscribeAddress} onChange={(e) => { setSubscribeAddress(e.target.value); setSubscribeStatus(null); }} placeholder="0x... wallet address" style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.95rem', border: '2px solid #bae6fd', borderRadius: '8px', outline: 'none', fontFamily: 'monospace' }} onFocus={(e) => e.target.style.borderColor = '#0ea5e9'} onBlur={(e) => e.target.style.borderColor = '#bae6fd'} />
            <button onClick={handleSubscribe} disabled={subscribing || !subscribeAddress.trim()} style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: '600', background: (subscribing || !subscribeAddress.trim()) ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: (subscribing || !subscribeAddress.trim()) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{subscribing ? '⏳ Subscribing...' : '➕ Subscribe'}</button>
          </div>
          {subscribeStatus && <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', background: subscribeStatus.success ? '#dcfce7' : '#fee2e2', color: subscribeStatus.success ? '#166534' : '#991b1b', border: `1px solid ${subscribeStatus.success ? '#86efac' : '#fecaca'}` }}>{subscribeStatus.success ? '✅' : '❌'} {subscribeStatus.message}</div>}
        </div>
      </div>
    </>
  );
};

// ==================== MAIN APP ====================
function App() {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [keylessAccountData, setKeylessAccountData] = useState<KeylessAccountData | null>(null);
  const [keylessAccount, setKeylessAccount] = useState<KeylessAccount | null>(null);
  const [balance, setBalance] = useState('0.00');

  useEffect(() => {
    const savedAccount = localStorage.getItem('keyless_account');
    if (savedAccount) {
      try {
        const accountData: KeylessAccountData = JSON.parse(savedAccount);
        setKeylessAccountData(accountData);
        setUser(accountData.userData);
      } catch (err) { console.error('Failed to restore account data:', err); localStorage.removeItem('keyless_account'); }
    }
  }, []);

  useEffect(() => { if (keylessAccountData?.address) { fetchBalance(keylessAccountData.address); } }, [keylessAccountData]);

  const fetchBalance = async (address: string) => {
    try {
      if (!address) { setBalance('0.00'); return; }
      const balanceInOctas = await aptos.getAccountAPTAmount({ accountAddress: address });
      setBalance((Number(balanceInOctas) / 100000000).toFixed(2));
    } catch (err) { setBalance('0.00'); }
  };

  const handleSignIn = (userData: GoogleUser, accountData: KeylessAccountData, keylessAccountObj: KeylessAccount) => {
    setUser(userData);
    setKeylessAccountData(accountData);
    setKeylessAccount(keylessAccountObj);
  };

  const handleSignOut = () => {
    setUser(null);
    setKeylessAccountData(null);
    setKeylessAccount(null);
    localStorage.removeItem('keyless_account');
  };

  if (!user || !keylessAccountData) {
    return <SignInScreen onSignIn={handleSignIn} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', padding: '2rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '2rem' }}>
        <ProfileSidebar user={user} address={keylessAccountData.address} balance={balance} onSignOut={handleSignOut} />
        <MainContent address={keylessAccountData.address} keylessAccount={keylessAccount} />
      </div>
    </div>
  );
}

export default App;