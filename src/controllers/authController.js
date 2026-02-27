const authService = require("../services/authService");
const walletService = require("../services/walletService");

/**
 * Register a new user
 * POST /auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, wallet, signature } = req.body;

    // Validation
    if (!email || !password || !wallet || !signature) {
      return res.status(400).json({
        error: "Email, password, wallet, and signature are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
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

    // Register user with wallet
    const user = await authService.registerUserWithWallet(
      email,
      password,
      wallet,
    );

    // Clear nonce after successful registration
    await walletService.deleteNonce(wallet);

    // Generate JWT token
    const token = authService.generateToken({
      id: user.id,
      email: user.email,
      wallet_address: user.wallet_address,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        wallet_address: user.wallet_address,
      },
      token,
    });
  } catch (error) {
    if (error.code === "23505") {
      // Check which constraint failed
      if (error.constraint === "users_email_key") {
        return res.status(409).json({
          error: "Email already exists",
        });
      }
      if (error.constraint === "users_wallet_address_key") {
        return res.status(409).json({
          error: "Wallet address already registered",
        });
      }
      return res.status(409).json({
        error: "Email or wallet address already exists",
      });
    }

    next(error);
  }
};

/**
 * Login user
 * POST /auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const result = await authService.authenticateUser(
      email,
      password,
    );

    res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    // Invalid credentials
    if (error.message === "Invalid email or password") {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    next(error);
  }
};

module.exports = {
  register,
  login,
};
