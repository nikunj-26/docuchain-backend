const walletService = require("../services/walletService");
const authService = require("../services/authService");

/**
 * Get nonce for wallet
 * GET /auth/nonce?wallet=0x...
 */
const getNonce = async (req, res, next) => {
  try {
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({
        error: "Wallet address is required",
      });
    }

    // Basic address validation
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: "Invalid wallet address",
      });
    }

    const nonce = await walletService.createNonce(wallet);

    res.status(200).json({
      message: "Nonce generated successfully",
      message_to_sign: `Welcome to Doc Verify!\n\nPlease sign this message to authenticate:\n\n${nonce}`,
      nonce,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login with wallet signature
 * POST /auth/wallet-login
 */
const walletLogin = async (req, res, next) => {
  try {
    const { wallet, signature } = req.body;

    // Validation
    if (!wallet || !signature) {
      return res.status(400).json({
        error: "Wallet and signature are required",
      });
    }

    // Validate wallet address format
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        error: "Invalid wallet address",
      });
    }

    // Get stored nonce
    const storedNonce = await walletService.getNonce(wallet);
    if (!storedNonce) {
      return res.status(400).json({
        error:
          "Nonce not found or expired. Please request a new nonce.",
      });
    }

    // Construct message
    const messageToSign = `Welcome to Doc Verify!\n\nPlease sign this message to authenticate:\n\n${storedNonce.nonce}`;

    // Verify signature
    const isValid = await walletService.verifySignature(
      wallet,
      messageToSign,
      signature,
    );
    if (!isValid) {
      return res.status(401).json({
        error: "Invalid signature",
      });
    }

    // Find user by wallet (do not auto-create)
    const user = await walletService.findUserByWallet(wallet);

    if (!user) {
      return res.status(404).json({
        error:
          "No account found for this wallet. Please register first.",
      });
    }

    // Clear nonce
    await walletService.deleteNonce(wallet);

    // Generate JWT
    const token = authService.generateToken({
      id: user.id,
      email: user.email,
      wallet_address: user.wallet_address,
    });

    res.status(200).json({
      message: "Wallet login successful",
      user: {
        id: user.id,
        email: user.email,
        wallet_address: user.wallet_address,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNonce,
  walletLogin,
};
