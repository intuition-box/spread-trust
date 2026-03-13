import { createWalletClient, createPublicClient, http, formatEther, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import jsQR from 'jsqr'

const intuitionChain = {
  id: 1155,
  name: 'Intuition',
  nativeCurrency: { name: 'Trust', symbol: 'TRUST', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.intuition.systems/http'] },
  },
  blockExplorers: {
    default: { name: 'Intuition Explorer', url: 'https://explorer.intuition.systems' },
  },
}

const transport = http(intuitionChain.rpcUrls.default.http[0])

// --- Wallet management ---

function getOrCreateWallet() {
  let pk = localStorage.getItem('spread-trust-pk')
  if (!pk) {
    // Generate random 32 bytes as hex private key
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    pk = '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem('spread-trust-pk', pk)
  }
  return privateKeyToAccount(pk)
}

const account = getOrCreateWallet()

const walletClient = createWalletClient({
  account,
  chain: intuitionChain,
  transport,
})

const publicClient = createPublicClient({
  chain: intuitionChain,
  transport,
})

// --- UI ---

const $address = document.getElementById('wallet-address')
const $balance = document.getElementById('balance')
const $scanBtn = document.getElementById('scan-btn')
const $stopScanBtn = document.getElementById('stop-scan-btn')
const $scannerContainer = document.getElementById('scanner-container')
const $video = document.getElementById('scanner-video')
const $sendForm = document.getElementById('send-form')
const $sendTo = document.getElementById('send-to')
const $sendAmount = document.getElementById('send-amount')
const $sendBtn = document.getElementById('send-btn')
const $status = document.getElementById('status')
const $pageMain = document.getElementById('page-main')
const $pageSettings = document.getElementById('page-settings')
const $openSettings = document.getElementById('open-settings')
const $backBtn = document.getElementById('back-btn')
const $settingAmount = document.getElementById('setting-amount')
const $settingAutosend = document.getElementById('setting-autosend')

$address.textContent = account.address
$address.addEventListener('click', () => {
  navigator.clipboard.writeText(account.address)
  setStatus('Address copied!', 'info')
})

async function refreshBalance() {
  try {
    const bal = await publicClient.getBalance({ address: account.address })
    $balance.textContent = formatEther(bal)
  } catch {
    $balance.textContent = '—'
  }
}
refreshBalance()
setInterval(refreshBalance, 15000)

function setStatus(msg, type = 'info') {
  $status.textContent = msg
  $status.className = `status-${type}`
}

// --- QR Scanner ---

let scanning = false
let scanStream = null
let scanInterval = null
const scanCanvas = document.createElement('canvas')
const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true })
const useNative = 'BarcodeDetector' in window

async function startScan() {
  if (scanning) return

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
  } catch {
    setStatus('Camera access denied', 'error')
    return
  }

  scanning = true
  $video.srcObject = scanStream
  $scannerContainer.style.display = 'block'
  $scanBtn.style.display = 'none'
  $stopScanBtn.style.display = 'block'
  $sendForm.style.display = 'none'
  setStatus('Point camera at a QR code...', 'info')

  const detector = useNative ? new BarcodeDetector({ formats: ['qr_code'] }) : null

  scanInterval = setInterval(async () => {
    if (!scanning || !$video.videoWidth) return
    try {
      if (detector) {
        const barcodes = await detector.detect($video)
        if (barcodes.length > 0) handleScannedValue(barcodes[0].rawValue)
      } else {
        scanCanvas.width = $video.videoWidth
        scanCanvas.height = $video.videoHeight
        scanCtx.drawImage($video, 0, 0)
        const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) handleScannedValue(code.data)
      }
    } catch {
      // detection can fail on some frames, ignore
    }
  }, 300)
}

function stopScan() {
  scanning = false
  if (scanInterval) clearInterval(scanInterval)
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop())
    scanStream = null
  }
  $video.srcObject = null
  $scannerContainer.style.display = 'none'
  $scanBtn.style.display = 'block'
  $stopScanBtn.style.display = 'none'
}

function handleScannedValue(value) {
  stopScan()

  // Extract ethereum address — support raw address or EIP-681 URIs
  let address = value.trim()
  if (address.startsWith('ethereum:')) {
    address = address.replace('ethereum:', '').split('@')[0].split('/')[0].split('?')[0]
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    setStatus(`Invalid address: ${value}`, 'error')
    return
  }

  const settings = loadSettings()

  if (settings.autoSend && settings.defaultAmount) {
    sendTo(address, settings.defaultAmount)
    return
  }

  $sendTo.textContent = address
  $sendForm.style.display = 'block'
  $sendAmount.value = settings.defaultAmount || ''
  if (!settings.defaultAmount) $sendAmount.focus()
  setStatus('Enter amount and send', 'info')
}

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const current = parseFloat($sendAmount.value) || 0
    $sendAmount.value = current + Number(chip.dataset.add)
  })
})

$scanBtn.addEventListener('click', startScan)
$stopScanBtn.addEventListener('click', () => {
  stopScan()
  setStatus('', 'info')
})

// --- Send transaction ---

async function sendTo(to, amountStr) {
  if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
    setStatus('Enter a valid amount', 'error')
    return
  }

  $sendBtn.disabled = true
  setStatus('Sending...', 'info')

  try {
    const value = parseEther(amountStr)
    const hash = await walletClient.sendTransaction({ to, value })
    setStatus('', 'info')
    $status.innerHTML = `Sent! <a class="tx-link" href="${intuitionChain.blockExplorers.default.url}/tx/${hash}" target="_blank" rel="noopener">${hash.slice(0, 10)}...${hash.slice(-8)}</a>`
    $status.className = 'status-success'
    $sendForm.style.display = 'none'
    refreshBalance()
  } catch (err) {
    setStatus(`Failed: ${err.shortMessage || err.message}`, 'error')
  } finally {
    $sendBtn.disabled = false
  }
}

$sendBtn.addEventListener('click', () => {
  sendTo($sendTo.textContent, $sendAmount.value.trim())
})

// --- Settings ---

function loadSettings() {
  return {
    defaultAmount: localStorage.getItem('spread-trust-amount') || '',
    autoSend: localStorage.getItem('spread-trust-autosend') === 'true',
  }
}

function saveSettings() {
  localStorage.setItem('spread-trust-amount', $settingAmount.value.trim())
  localStorage.setItem('spread-trust-autosend', $settingAutosend.checked)
}

// Init settings UI
const savedSettings = loadSettings()
$settingAmount.value = savedSettings.defaultAmount
$settingAutosend.checked = savedSettings.autoSend

$settingAmount.addEventListener('change', saveSettings)
$settingAutosend.addEventListener('change', saveSettings)

$openSettings.addEventListener('click', () => {
  $pageMain.classList.add('hidden')
  $pageSettings.classList.remove('hidden')
})

$backBtn.addEventListener('click', () => {
  saveSettings()
  $pageSettings.classList.add('hidden')
  $pageMain.classList.remove('hidden')
})

// --- PWA service worker ---

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
