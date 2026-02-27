const express = require("express");
const walletController = require("../controllers/walletController");

const router = express.Router();

router.get("/nonce", walletController.getNonce);
router.post("/wallet-login", walletController.walletLogin);

module.exports = router;
