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
  Ed25519PrivateKey,
  AnyPublicKey,
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
const GOOGLE_CLIENT_ID = '305427741136-j3j4r125hp5sqp5ojjdvcf5oomerckfn.apps.googleusercontent.com';
const MODULE_ADDRESS = '0x0e8ff60af3c4d82f19afae4e316e82a27bbfe9ab7f22e805e0a0b58034e8df15';

// ==================== SIGN IN COMPONENT ====================
const SignInScreen: React.FC<{ onSignIn: (user: GoogleUser, account: KeylessAccountData, keylessAccount: KeylessAccount) => void }> = ({ onSignIn }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pepper, setPepper] = useState<string>(localStorage.getItem('test_pepper') || '');
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
      if (pepper) {
        localStorage.setItem('test_pepper', pepper);
      } else {
        localStorage.removeItem('test_pepper');
      }

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
        pepper: pepper ? (pepper.startsWith('0x') ? pepper : `0x${pepper}`) : undefined,
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
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem', textAlign: 'left' }}>🧪 TEST SALT (HEX - OPTIONAL)</label>
              <input
                type="text"
                value={pepper}
                onChange={(e) => setPepper(e.target.value)}
                placeholder="0x... (generates a fresh address)"
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
              />
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem', textAlign: 'left' }}>Change this to get a new account address for testing.</p>
            </div>
            <div id="googleSignInButton" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}></div>
            <p style={{ fontSize: '0.9rem', color: '#999' }}>Powered by Aptos Keyless Authentication</p>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== BACKUP KEY MODAL ====================
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

// ==================== PROFILE SIDEBAR ====================
// ==================== HELPERS ====================
async function resolveSigner(
  keylessAccount: KeylessAccount,
  backupPrivateKeyStr: string | null
): Promise<KeylessAccount | MultiKeyAccount> {
  if (!backupPrivateKeyStr) return keylessAccount;

  try {
    const rawKey = backupPrivateKeyStr.replace('ed25519-priv-', '').trim();
    if (!rawKey) return keylessAccount;

    const backupAccount = Account.fromPrivateKey({
      privateKey: new Ed25519PrivateKey(rawKey),
    });

    // NOTE: We MUST match the order expected on-chain (Keyless first).
    // Using static constructor for better reliability with indices.
    return MultiKeyAccount.fromPublicKeysAndSigners({
      address: keylessAccount.accountAddress,
      publicKeys: [
        keylessAccount.publicKey,
        backupAccount.publicKey,
      ],
      signaturesRequired: 1,
      signers: [keylessAccount],
    });
  } catch (err) {
    console.warn('Error resolving MultiKey signer:', err);
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
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupKeyInstalled, setBackupKeyInstalled] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  // Check if backup key is already installed (stored in localStorage)
  useEffect(() => {
    const installed = localStorage.getItem(`backup_key_installed_${address}`);
    if (installed === 'true') {
      setBackupKeyInstalled(true);
    }
  }, [address]);

  const installBackupKey = async (): Promise<string> => {
    if (!keylessAccount) {
      throw new Error('Keyless account not available. Please sign in again.');
    }

    // Step 1: Generate new Ed25519 keypair for backup
    const backupAccount = Account.generate();
    const backupPublicKey = backupAccount.publicKey;

    // Step 2: Get account info (sequence number and current auth key) for the proof
    const accountDataInfo = await aptos.getAccountInfo({ accountAddress: keylessAccount.accountAddress });
    const sequenceNumber = BigInt(accountDataInfo.sequence_number);

    // Step 3: Construct the RotationProofChallenge message
    const typeInfoSerializer = new Serializer();
    const addr0x1 = new Uint8Array(32);
    addr0x1[31] = 1;
    typeInfoSerializer.serializeFixedBytes(addr0x1);
    typeInfoSerializer.serializeBytes(new TextEncoder().encode("account")); // module_name
    typeInfoSerializer.serializeBytes(new TextEncoder().encode("RotationProofChallenge")); // struct_name
    const typeInfoBytes = typeInfoSerializer.toUint8Array();

    const challengeSerializer = new Serializer();
    challengeSerializer.serializeU64(sequenceNumber);
    challengeSerializer.serializeFixedBytes(keylessAccount.accountAddress.toUint8Array()); // originator
    challengeSerializer.serializeFixedBytes(keylessAccount.accountAddress.toUint8Array()); // current_auth_key
    challengeSerializer.serializeBytes(backupPublicKey.toUint8Array()); // new_public_key
    const challengeBytes = challengeSerializer.toUint8Array();

    const messageToSign = new Uint8Array(typeInfoBytes.length + challengeBytes.length);
    messageToSign.set(typeInfoBytes);
    messageToSign.set(challengeBytes, typeInfoBytes.length);

    // Step 4: Sign the message with the backup key to create the proof
    const proofSignature = backupAccount.sign(messageToSign);
    const proofBytes = proofSignature.toUint8Array();

    // Step 5: Build implementation data
    const serializerForPK = new Serializer();
    serializerForPK.serializeU8(3); // Keyless variant inside AnyPublicKey
    (keylessAccount.publicKey as any).serialize(serializerForPK);
    const keylessPublicKeyBytes = serializerForPK.toUint8Array();

    const backupPublicKeyAny = new AnyPublicKey(backupPublicKey);
    const backupPublicKeyBytes = backupPublicKeyAny.toUint8Array();

    const transaction = await aptos.transaction.build.simple({
      sender: keylessAccount.accountAddress,
      data: {
        function: '0x1::account::upsert_ed25519_backup_key_on_keyless_account',
        typeArguments: [],
        functionArguments: [
          keylessPublicKeyBytes,
          backupPublicKeyBytes,
          proofBytes,
        ],
      },
    });

    // Step 6: Sign and Submit using existing backup key if available (allows rotation repair)
    const savedAccount = localStorage.getItem('keyless_account');
    let existingBackupKey = null;
    if (savedAccount) {
      const parsed = JSON.parse(savedAccount);
      existingBackupKey = parsed.backupPrivateKey;
    }
    const signer = await resolveSigner(keylessAccount, existingBackupKey || null);

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer,
      transaction,
    });

    // Step 7: Wait for confirmation
    await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

    localStorage.setItem(`backup_key_installed_${address}`, 'true');
    localStorage.setItem(`backup_public_key_${address}`, backupPublicKey.toString());
    setBackupKeyInstalled(true);

    const fullKey = backupAccount.privateKey.toString();
    // Automatically "connect" and update parent state
    onImportBackupKey(fullKey);

    return fullKey;
  };

  const handleResetApp = () => {
    if (window.confirm('This will clear all local storage and sign you out. Your blockchain account will NOT be deleted. Proceed?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <>
      {showBackupModal && (
        <BackupKeyModal
          privateKeyHex=""
          onClose={() => setShowBackupModal(false)}
          onInstall={installBackupKey}
        />
      )}
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
              <button
                onClick={() => {
                  navigator.clipboard.writeText(address);
                  setAddressCopied(true);
                  setTimeout(() => setAddressCopied(false), 2000);
                }}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  background: addressCopied ? '#10b981' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {addressCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', marginBottom: '1.5rem', color: 'white' }}>
          <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.9 }}>BALANCE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{balance} APT</div>
        </div>

        {backupKeyInstalled ? (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: '600' }}>✅ Backup Key Active</span>
              <p style={{ fontSize: '0.75rem', color: '#15803d', margin: '0.25rem 0 0 0' }}>MultiKey Protection Enabled</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setShowBackupModal(true)}
              disabled={!keylessAccount}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: keylessAccount ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#cbd5e0',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: keylessAccount ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}
            >
              🔑 Install Backup Key
            </button>
            <button
              onClick={() => {
                const key = prompt('Please enter your existing backup private key (hex):');
                if (key) {
                  onImportBackupKey(key.trim());
                  localStorage.setItem(`backup_key_installed_${address}`, 'true');
                  setBackupKeyInstalled(true);
                  alert('Backup key imported successfully! Your session is now synchronized.');
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'transparent',
                color: '#d97706',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600'
              }}
            >
              📥 Already have a key? Import
            </button>
          </div>
        )}

        <button onClick={onSignOut} style={{ width: '100%', padding: '0.75rem', background: '#f56565', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Sign Out</button>

        <button onClick={handleResetApp} style={{ width: '100%', padding: '0.5rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500', marginBottom: '1rem' }}>
          🔄 Reset Application State
        </button>

        <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Network: {APTOS_CONFIG.network}</span>
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

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
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