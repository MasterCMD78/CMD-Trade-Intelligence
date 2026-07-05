import { Router } from "express";

const router = Router();

router.get("/:symbol", async (req, res) => {

  const { symbol } = req.params;

  res.json({

    symbol,

    decision: "HOLD",

    confidence: 0,

    reasons: [],

    summary: "AI integration coming next."

  });

});

export default router;