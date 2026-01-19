import React, { useState, useEffect, useRef } from 'react';
import {
  Aptos,
  AptosConfig,
  Network,
  EphemeralKeyPair,
  KeylessAccount,
  Account,
  Serializer,
  MultiKeyAccount,
  MultiKey,
  AnyPublicKey,
  Ed25519PublicKey,
  Ed25519PrivateKey,
  Hex,
  Deserializer,
} from '@aptos-labs/ts-sdk';
import { jwtDecode } from 'jwt-decode';
//ed25519-priv-0xfc0e3afedec87d15b53bfd56e69eec07301ed96ab2eca6d9e50bf9a786c1ebfb

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
  backupPrivateKey?: string;
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
const APTOS_CONFIG = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(APTOS_CONFIG);
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const MODULE_ADDRESS = import.meta.env.VITE_MODULE_ADDRESS;

// ==================== SIGN IN COMPONENT ====================
const SignInScreen: React.FC<{ onSignIn: (user: GoogleUser, account: KeylessAccountData, keylessAccount: KeylessAccount) => void }> = ({ onSignIn }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ephemeralKeyPairRef = useRef<EphemeralKeyPair | null>(null);

  useEffect(() => { loadGoogleScript(); }, []);

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
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 250
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

      if (!ephemeralKeyPairRef.current) throw new Error('Ephemeral key pair not generated');

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)', padding: '2rem' }}>
      <div style={{ background: 'rgba(255, 255, 255, 0.95)', borderRadius: '32px', padding: '4rem 2rem', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
        <style>
          {`@keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }`}
        </style>

        <div style={{ fontSize: '6rem', marginBottom: '1.5rem', animation: 'float 4s ease-in-out infinite', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.2))' }}>📺</div>

        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
          Channelz
        </h1>
        <p style={{ color: '#718096', fontSize: '1.1rem', marginBottom: '2.5rem', lineHeight: '1.6' }}>
          Create and own your decentralized media channel on <span style={{ fontWeight: '600', color: '#667eea' }}>Aptos</span>.
        </p>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fff5f5', borderLeft: '4px solid #f56565', borderRadius: '4px', color: '#c53030', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'left' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #667eea', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}></div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            <div style={{ color: '#718096', fontWeight: '500' }}>Authenticating securely...</div>
          </div>
        ) : (
          <>
            <div id="googleSignInButton" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', height: '50px' }}></div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#a0aec0' }}>
                Powered by <strong>Aptos Keyless</strong>
                <br />
                No wallets or private keys needed.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== DEBUG INFO COMPONENT ====================
// DebugInfo helper... (Hidden for now)
/*
const DebugInfo: React.FC<{
  address: string;
  keylessAccount: KeylessAccount | null;
}> = ({ address, keylessAccount }) => {
  const [info, setInfo] = useState<any>(null);

  const fetchDebugInfo = async () => {
    if (!keylessAccount) return;
    try {
      const accountInfo = await aptos.getAccountInfo({ accountAddress: keylessAccount.accountAddress });
      const onChainAuthKey = accountInfo.authentication_key;
      const localAuthKey = keylessAccount.accountAddress.toString();

      const backupKeyStored = localStorage.getItem(`backup_public_key_${address}`);
      const backupKeyInstalled = localStorage.getItem(`backup_key_installed_${address}`);

      setInfo({
        onChainAuthKey,
        localAuthKey,
        isRotated: onChainAuthKey !== localAuthKey,
        backupKeyStored: !!backupKeyStored,
        backupKeyInstalled,
        sequenceNumber: accountInfo.sequence_number
      });
    } catch (e: any) {
      setInfo({ error: e.message });
    }
  };

  useEffect(() => { fetchDebugInfo(); }, [address, keylessAccount]);

  if (!info) return null;

  return (
    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#1a202c', borderRadius: '8px', fontSize: '0.7rem', color: '#a0aec0', fontFamily: 'monospace' }}>
      <div style={{ fontWeight: 'bold', color: '#e2e8f0', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>🐞 DEBUG DIAGNOSTICS</span>
        <button onClick={fetchDebugInfo} style={{ border: 'none', background: 'none', color: '#63b3ed', cursor: 'pointer' }}>↻</button>
      </div>

      {info.error ? (
        <div style={{ color: '#fc8181' }}>Error: {info.error}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div><span style={{ color: '#63b3ed' }}>Rotated:</span> <span style={{ color: info.isRotated ? '#f6ad55' : '#68d391' }}>{info.isRotated ? 'YES (MultiKey)' : 'NO (SingleKey)'}</span></div>
          <div style={{ wordBreak: 'break-all' }}><span style={{ color: '#718096' }}>Chain Auth:</span> {info.onChainAuthKey}</div>
          <div style={{ wordBreak: 'break-all' }}><span style={{ color: '#718096' }}>Local Auth:</span> {info.localAuthKey}</div>
          <div><span style={{ color: '#718096' }}>Backup Key in Storage:</span> {info.backupKeyStored ? 'YES' : 'NO'}</div>
          <div><span style={{ color: '#718096' }}>Marked Installed:</span> {info.backupKeyInstalled ? 'TRUE' : 'FALSE'}</div>
          <div><span style={{ color: '#718096' }}>Seq Num:</span> {info.sequenceNumber}</div>
        </div>
      )}
    </div>
  );
};
*/
// BackupKeyModal helper... (Hidden for now)
/*
const BackupKeyModal: React.FC<{
  privateKeyHex: string;
  onClose: () => void;
  onInstall?: () => Promise<string>;
  isInstalling?: boolean;
}> = ({ privateKeyHex, onClose, onInstall }) => {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<'warning' | 'installing' | 'display'>(privateKeyHex ? 'display' : 'warning');
  const [understandPermanent, setUnderstandPermanent] = useState(false);
  const [understandMultisig, setUnderstandMultisig] = useState(false);
  const [understandBackup, setUnderstandBackup] = useState(false);
  const [installError, setInstallError] = useState('');
  const [generatedKey, setGeneratedKey] = useState(privateKeyHex);

  const canProceed = understandPermanent && understandMultisig && understandBackup;

  const handleInstall = async () => {
    if (!onInstall) return;
    setPhase('installing');
    setInstallError('');
    try {
      const key = await onInstall();
      setGeneratedKey(key);
      setPhase('display');
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Failed to install backup key');
      setPhase('warning');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (phase === 'warning') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '550px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.5rem', color: '#991b1b', margin: 0 }}>Important Warning</h2>
          </div>

          <div style={{ padding: '1rem', background: '#fef2f2', border: '2px solid #fecaca', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.95rem', color: '#991b1b', fontWeight: '600', marginBottom: '0.75rem' }}>🔒 This is a PERMANENT on-chain operation</div>
            <p style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: '0 0 0.75rem 0' }}>
              Installing a backup key will permanently convert your account into a <strong>1-of-2 multisig account</strong>. This means:
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: 0, paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>Your keyless (Google) login will still work</li>
              <li style={{ marginBottom: '0.5rem' }}>The backup private key can ALSO access your account</li>
              <li style={{ marginBottom: '0.5rem' }}>Either key alone can sign transactions</li>
              <li style={{ marginBottom: '0.5rem' }}><strong>This cannot be undone</strong></li>
            </ul>
          </div>

          <div style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde047', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#92400e' }}>
              <strong>💡 What this enables:</strong><br />
              After installation, you can import the backup private key into Petra Wallet or any Aptos wallet to access the same account and see your Channelz NFT.
            </div>
          </div>

          {installError && (
            <div style={{ padding: '1rem', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c33', marginBottom: '1rem', fontSize: '0.9rem' }}>
              ❌ {installError}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.85rem', color: '#4a5568', marginBottom: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={understandPermanent} onChange={(e) => setUnderstandPermanent(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }} />
              <span>I understand this is a <strong>permanent, irreversible</strong> on-chain operation</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.85rem', color: '#4a5568', marginBottom: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={understandMultisig} onChange={(e) => setUnderstandMultisig(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }} />
              <span>I understand my account will become a <strong>1-of-2 multisig</strong> account</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.85rem', color: '#4a5568', cursor: 'pointer' }}>
              <input type="checkbox" checked={understandBackup} onChange={(e) => setUnderstandBackup(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0 }} />
              <span>I understand I must <strong>securely save</strong> the backup key - anyone with it can access my funds</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', background: '#e2e8f0', color: '#4a5568', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>
              Cancel
            </button>
            <button onClick={handleInstall} disabled={!canProceed} style={{ flex: 1, padding: '0.75rem', background: canProceed ? '#dc2626' : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: canProceed ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: '600' }}>
              🔐 Install Backup Key
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'installing') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '3rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>⚙️</div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <h2 style={{ fontSize: '1.25rem', color: '#1a202c', marginBottom: '0.5rem' }}>Installing Backup Key</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: 0 }}>
            Please wait while we rotate your authentication key on the blockchain...
          </p>
          <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '1rem' }}>
            ⚠️ Do not close this window
          </p>
        </div>
      </div>
    );
  }

  // Display phase
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '90%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', color: '#16a34a', margin: 0 }}>Backup Key Installed!</h2>
        </div>

        <div style={{ padding: '1rem', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#166534' }}>
            ✅ Your account is now a 1-of-2 multisig. You can use either your Google login OR this backup key to access your account.
          </div>
        </div>

        <div style={{ padding: '1rem', background: '#fef2f2', border: '2px solid #fecaca', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: '600', marginBottom: '0.5rem' }}>⚠️ SAVE THIS KEY NOW</div>
          <ul style={{ fontSize: '0.8rem', color: '#991b1b', margin: 0, paddingLeft: '1.2rem' }}>
            <li>This key is shown only once</li>
            <li>Never share this key with anyone</li>
            <li>Store it in a secure location</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.5rem', fontWeight: '600' }}>BACKUP PRIVATE KEY (Hex Format)</div>
          <div style={{ padding: '0.75rem', background: '#1a202c', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.7rem', color: '#10b981', wordBreak: 'break-all', maxHeight: '80px', overflow: 'auto' }}>
            {generatedKey}
          </div>
        </div>

        <button onClick={handleCopy} style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', background: copied ? '#10b981' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>
          {copied ? '✅ Copied to Clipboard!' : '📋 Copy Private Key'}
        </button>

        <div style={{ padding: '1rem', background: '#fffbeb', border: '1px solid #fde047', borderRadius: '8px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
            <strong>💡 How to use:</strong> Import this key into Petra Wallet using "Import Private Key" option. You'll see your same account and Channelz NFT.
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#4a5568', marginBottom: '1rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: '18px', height: '18px' }} />
          I have saved my private key securely
        </label>

        <button onClick={onClose} disabled={!confirmed} style={{ width: '100%', padding: '0.75rem', background: confirmed ? '#10b981' : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: confirmed ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: '600' }}>
          {confirmed ? '✅ Done' : 'Confirm to Close'}
        </button>
      </div>
    </div>
  );
};
*/

// ==================== PROFILE SIDEBAR ====================
// ==================== HELPERS ====================
// ==================== HELPERS ====================
async function resolveSigner(
  keylessAccount: KeylessAccount,
  backupPrivateKeyStr: string | null
): Promise<KeylessAccount | MultiKeyAccount> {
  console.group('🔐 resolveSigner Debug');
  try {
    const accountInfo = await aptos.getAccountInfo({ accountAddress: keylessAccount.accountAddress });
    const onChainAuthKey = accountInfo.authentication_key;
    const localAuthKey = keylessAccount.accountAddress.toString();

    console.log('Auth Check:', { onChain: onChainAuthKey, local: localAuthKey });

    if (onChainAuthKey === localAuthKey) {
      console.log('✅ Account NOT rotated. Using KeylessAccount.');
      console.groupEnd();
      return keylessAccount;
    }

    console.warn('⚠️ Account IS rotated (MultiKey detected). Recovery needed.');

    let backupPublicKey: Ed25519PublicKey | null = null;
    let keylessPkFromHistory: any | null = null;
    let source = 'NONE';

    // 1. Recover Keys from History
    console.log('🔍 Searching transaction history for rotation event...');
    try {
      const transactions = await aptos.getAccountTransactions({ accountAddress: keylessAccount.accountAddress, options: { limit: 100 } });

      for (const tx of transactions) {
        if (!('payload' in tx) || !('function' in tx.payload)) continue;

        if (tx.payload.function.includes('upsert_ed25519_backup_key')) {
          console.log('Found rotation tx:', tx.hash);
          const args = tx.payload.arguments;
          if (args && args.length >= 2) {
            // Extract Keyless PK (Arg 0)
            try {
              const kHex = args[0];
              const kBytes = Hex.fromHexString(kHex).toUint8Array();
              console.log('History Keyless PK Bytes:', kBytes);

              // Try to deserialize as AnyPublicKey (likely starts with 3)
              const deserializer = new Deserializer(kBytes);
              const anyPk = AnyPublicKey.deserialize(deserializer);
              keylessPkFromHistory = anyPk; // This is an AnyPublicKey instance wrapping the KeylessPublicKey
              console.log('✅ Successfully deserialized Keyless PK from history');
            } catch (e) {
              console.warn('Failed to deserialize Keyless PK from history bytes:', e);
            }

            // Extract Backup PK (Arg 1)
            const backupPkHex = args[1];
            const backupPkBytes = Hex.fromHexString(backupPkHex).toUint8Array();

            if (backupPkBytes.length === 32) {
              backupPublicKey = new Ed25519PublicKey(backupPkBytes);
              source = 'HISTORY_RAW_32';
            } else if (backupPkBytes.length === 33) {
              try {
                const deserializer = new Deserializer(backupPkBytes);
                // Peek variant
                const variant = backupPkBytes[0];
                // Note: deserializer.deserializeUleb128AsU32() would actially consume it.
                // But let's just assume AnyPublicKey format if generic deserialize fails
                const anyPk = AnyPublicKey.deserialize(deserializer);
                if (anyPk.publicKey instanceof Ed25519PublicKey) {
                  backupPublicKey = anyPk.publicKey;
                  source = 'HISTORY_ANY_33';
                }
              } catch (e) {
                // Fallback unique logic for Ed25519
                try {
                  const d = new Deserializer(backupPkBytes);
                  if (d.deserializeUleb128AsU32() === 0) {
                    backupPublicKey = Ed25519PublicKey.deserialize(d);
                    source = 'HISTORY_ANY_33_MANUAL';
                  }
                } catch (e2) { }
              }
            }
          }
          if (backupPublicKey) break;
        }
      }
    } catch (e) { console.error('History fetch failed:', e); }

    // Backup Key Override from Local Arg
    if (backupPrivateKeyStr) {
      try {
        const rawKey = backupPrivateKeyStr.replace('ed25519-priv-', '').trim();
        const backupAccount = Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(rawKey) });
        backupPublicKey = backupAccount.publicKey;
        source = 'PRIVATE_KEY_ARG (Override)';
        console.log('✅ Used Local Private Key override');
      } catch (e) { console.warn('Invalid local backup key provided', e); }
    }

    if (!backupPublicKey) {
      console.error('❌ CRITICAL: Failed to recover Backup Public Key.');
      console.groupEnd();
      return keylessAccount;
    }

    // 2. Brute Force Discovery
    console.log('🔄 Attempting Brute Force Auth Key Discovery...');

    // Helper: Wrap in AnyPublicKey
    const wrapAny = (k: any) => {
      if (k instanceof AnyPublicKey) return k; // Already wrapped
      return new AnyPublicKey(k);
    };

    // Helper: Unwrap to Raw (if possible)
    const unwrapRaw = (k: any) => {
      if (k instanceof AnyPublicKey) return k.publicKey;
      return k;
    };

    // Candidates
    const candidatesKeyless: any[] = [];
    const candidatesBackup: any[] = [];

    // A. Keyless Candidates
    candidatesKeyless.push({ name: 'Local', key: keylessAccount.publicKey }); // Raw
    if (keylessPkFromHistory) {
      // keylessPkFromHistory is likely AnyPublicKey
      candidatesKeyless.push({ name: 'History', key: unwrapRaw(keylessPkFromHistory) });
    }

    // B. Backup Candidates
    candidatesBackup.push({ name: 'Backup', key: backupPublicKey });

    let winningScheme: any = null;

    // Iterate Combinations
    for (const k of candidatesKeyless) {
      for (const b of candidatesBackup) {
        // We test 4 variants per pair:
        // 1. [Raw, Raw]
        // 2. [Any, Any]
        // 3. [Raw, Any]
        // 4. [Any, Raw] (unlikely but possible)
        // AND we test 2 orders: [K, B] vs [B, K]

        // Let's simplfy by building specific keys
        const rawK = k.key;
        const anyK = wrapAny(k.key);
        const rawB = b.key;
        const anyB = wrapAny(b.key);

        const permutations = [
          { name: `[${k.name}(Raw), ${b.name}(Raw)]`, keys: [rawK, rawB] },
          { name: `[${k.name}(Any), ${b.name}(Any)]`, keys: [anyK, anyB] },
          { name: `[${b.name}(Raw), ${k.name}(Raw)]`, keys: [rawB, rawK] }, // Reverse
          { name: `[${b.name}(Any), ${k.name}(Any)]`, keys: [anyB, anyK] }, // Reverse
          // Mixed
          { name: `[${k.name}(Any), ${b.name}(Raw)]`, keys: [anyK, rawB] },
          { name: `[${b.name}(Any), ${k.name}(Raw)]`, keys: [anyB, rawK] },
        ];

        for (const p of permutations) {
          try {
            const mk = new MultiKey({ publicKeys: p.keys, signaturesRequired: 1 });
            const derivedAuthKey = mk.authKey().toString();
            if (derivedAuthKey === onChainAuthKey) {
              winningScheme = p;
              break;
            }
          } catch (e) { }
        }
        if (winningScheme) break;
      }
      if (winningScheme) break;
    }

    if (winningScheme) {
      console.log(`🎉 MATCH FOUND! Scheme: ${winningScheme.name}`);
      console.groupEnd();

      return MultiKeyAccount.fromPublicKeysAndSigners({
        address: keylessAccount.accountAddress,
        publicKeys: winningScheme.keys,
        signaturesRequired: 1,
        signers: [keylessAccount]
      });
    }

    console.error('❌ FATAL: All Brute Force attempts failed.');
    console.groupEnd();
    return keylessAccount;

  } catch (err) {
    console.error('resolveSigner Exception:', err);
    console.groupEnd();
    return keylessAccount;
  }
}

const ProfileSidebar: React.FC<{
  user: GoogleUser;
  address: string;
  balance: string;
  onSignOut: () => void;
  keylessAccount: KeylessAccount | null;
  onImportBackupKey: (key: string) => void;
}> = ({ user, address, balance, onSignOut, keylessAccount, onImportBackupKey }) => {
  // Suppress warnings for unused props (kept for future feature restoration)
  void keylessAccount;
  void onImportBackupKey;

  // Hard Reset: Clears storage to allow 'fresh' login attempts (requires email alias for new address)
  const handleResetApp = () => {
    if (confirm('To create a TRULY fresh account, sign in with a different email (e.g., user+test1@gmail.com). clearing local state now...')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Fancy CSS Styles for Profile */}
      <style>
        {`
          @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
          @keyframes glow { 0% { box-shadow: 0 0 5px #667eea, 0 0 10px #667eea; } 50% { box-shadow: 0 0 20px #764ba2, 0 0 30px #764ba2; } 100% { box-shadow: 0 0 5px #667eea, 0 0 10px #667eea; } }
          @keyframes gradient-x { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          .profile-card { animation: fadeIn 0.6s ease-out; }
          .avatar-container { animation: float 6s ease-in-out infinite; }
          .fancy-button { 
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab); 
            background-size: 400% 400%; 
            animation: gradient-x 15s ease infinite;
            transition: transform 0.2s;
          }
          .fancy-button:hover { transform: scale(1.02); }
        `}
      </style>

      <div className="profile-card" style={{ width: '280px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '24px', padding: '2rem', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', position: 'sticky', top: '2rem', border: '1px solid rgba(255,255,255,0.5)' }}>

        <div className="avatar-container" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ position: 'absolute', top: '-5px', left: '-5px', right: '-5px', bottom: '-5px', borderRadius: '50%', background: 'linear-gradient(45deg, #ff00cc, #3333ff)', zIndex: 0, filter: 'blur(8px)', opacity: 0.7, animation: 'glow 3s infinite' }}></div>
            <img
              src={user.picture}
              alt={user.name}
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                position: 'relative',
                zIndex: 1,
                border: '4px solid white',
                objectFit: 'cover'
              }}
            />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1a202c', marginTop: '1rem', letterSpacing: '-0.5px' }}>
            {user.name}
          </h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', fontWeight: '500' }}>{user.email}</p>
        </div>

        <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid #edf2f7' }}>
          <div style={{ fontSize: '0.7rem', color: '#a0aec0', marginBottom: '0.5rem', fontWeight: '700', letterSpacing: '0.05em' }}>APTOS ADDRESS</div>
          <div
            onClick={handleCopy}
            style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#4a5568', wordBreak: 'break-all', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
          <div style={{ textAlign: 'right', marginTop: '0.25rem', fontSize: '0.7rem', color: copied ? '#10b981' : '#cbd5e0', transition: 'color 0.3s' }}>
            {copied ? 'Copied!' : 'Click to copy'}
          </div>
        </div>

        <div style={{ padding: '1.25rem', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: '16px', marginBottom: '2rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginBottom: '0.25rem', fontWeight: '700', textTransform: 'uppercase' }}>Balance</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', background: 'linear-gradient(90deg, #30cfd0 0%, #330867 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {balance} <span style={{ fontSize: '1rem', fontWeight: '600' }}>APT</span>
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="fancy-button"
          style={{
            width: '100%',
            padding: '1rem',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '700',
            marginBottom: '1rem',
            boxShadow: '0 4px 15px rgba(231, 60, 126, 0.4)'
          }}
        >
          Sign Out
        </button>

        <button
          onClick={handleResetApp}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'transparent',
            color: '#cbd5e0',
            border: '1px dashed #cbd5e0',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e53e3e'; e.currentTarget.style.color = '#e53e3e'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e0'; e.currentTarget.style.color = '#cbd5e0'; }}
        >
          �️ Reset App State
        </button>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f0fff4', padding: '0.25rem 0.75rem', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}></div>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#166534' }}>{APTOS_CONFIG.network}</span>
          </div>
        </div>
      </div>
    </>
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
const MainContent: React.FC<{
  address: string;
  keylessAccount: KeylessAccount | null;
  backupPrivateKey: string | null;
}> = ({ address, keylessAccount, backupPrivateKey }) => {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [channelName, setChannelName] = useState('');
  const [nameStatus, setNameStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
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

      const signer = await resolveSigner(keylessAccount, backupPrivateKey);

      const transaction = await aptos.transaction.build.simple({
        sender: keylessAccount.accountAddress,
        data: {
          function: `${MODULE_ADDRESS}::account::create_account`,
          typeArguments: [],
          functionArguments: [channelName]
        }
      });
      const committedTxn = await aptos.signAndSubmitTransaction({ signer, transaction });
      await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
      setCreatedChannelName(channelName);
      setShowCongrats(true);
      await checkAccountExists();
      setChannelName('');
      setNameStatus(null);
    } catch (err: any) {
      console.error('Account creation failed:', err);
      let message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('INVALID_AUTH_KEY')) {
        message = 'Invalid authentication key. If you recently added a backup key, please ensure you are using the correct account or sign in again.';
      }
      alert('Failed to create account: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscription = async () => {
    if (!accountInfo) return;
    setToggling(true);
    try {
      if (!keylessAccount) throw new Error('Keyless account not available. Please sign in again.');

      const signer = await resolveSigner(keylessAccount, backupPrivateKey);
      const newStatus = !accountInfo.subscriptionEnabled;

      const transaction = await aptos.transaction.build.simple({
        sender: keylessAccount.accountAddress,
        data: {
          function: `${MODULE_ADDRESS}::account::set_subscription_enabled`,
          typeArguments: [],
          functionArguments: [newStatus]
        }
      });
      const committedTxn = await aptos.signAndSubmitTransaction({ signer, transaction });
      await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

      // Refresh local state immediately
      setAccountInfo({
        ...accountInfo,
        subscriptionEnabled: newStatus
      });
    } catch (err: any) {
      console.error('Toggle subscription failed:', err);
      alert('Failed to update subscription status: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setToggling(false);
    }
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

      const signer = await resolveSigner(keylessAccount, backupPrivateKey);

      const transaction = await aptos.transaction.build.simple({
        sender: keylessAccount.accountAddress,
        data: {
          function: `${MODULE_ADDRESS}::account::subscribe`,
          typeArguments: [],
          functionArguments: [subscribeAddress]
        }
      });
      const committedTxn = await aptos.signAndSubmitTransaction({ signer, transaction });
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
      else if (errorMessage.includes('INVALID_AUTH_KEY')) errorMessage = 'Authentication failed. Please sign in again or check your backup key status.';
      setSubscribeStatus({ success: false, message: errorMessage });
    } finally {
      setSubscribing(false);
    }
  };

  if (checking) {
    return (
      <>
        {showCongrats && <CongratulationsModal channelName={createdChannelName} onClose={() => setShowCongrats(false)} />}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ color: '#718096', fontWeight: '500' }}>Checking your Channelz status...</div>
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
        <div style={{ padding: '1.5rem', background: accountInfo?.subscriptionEnabled ? '#f0fdf4' : '#fef2f2', border: `2px solid ${accountInfo?.subscriptionEnabled ? '#bbf7d0' : '#fecaca'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: accountInfo?.subscriptionEnabled ? '#166534' : '#991b1b', marginBottom: '0.25rem' }}>Subscription Status</div>
            <div style={{ color: accountInfo?.subscriptionEnabled ? '#16a34a' : '#dc2626', fontSize: '1.1rem', fontWeight: 'bold' }}>
              {accountInfo?.subscriptionEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <button
            onClick={handleToggleSubscription}
            disabled={toggling}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: 'none',
              background: accountInfo?.subscriptionEnabled ? '#ef4444' : '#10b981',
              color: 'white',
              cursor: toggling ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              opacity: toggling ? 0.7 : 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {toggling ? '⏳ Updating...' : accountInfo?.subscriptionEnabled ? 'Disable Subscriptions' : 'Enable Subscriptions'}
          </button>
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
      setBalance((Number(balanceInOctas) / 100000000).toString());
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
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'stretch' }}>
          <ProfileSidebar
            user={user}
            address={keylessAccountData.address}
            balance={balance}
            onSignOut={handleSignOut}
            keylessAccount={keylessAccount}
            onImportBackupKey={(key) => {
              const updatedData = { ...keylessAccountData, backupPrivateKey: key };
              setKeylessAccountData(updatedData);
              localStorage.setItem('keyless_account', JSON.stringify(updatedData));
            }}
          />
          <MainContent
            address={keylessAccountData.address}
            keylessAccount={keylessAccount}
            backupPrivateKey={keylessAccountData.backupPrivateKey || null}
          />
        </div>
      </div>
    </div>
  );
}

export default App;