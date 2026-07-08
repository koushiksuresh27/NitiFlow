const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET /api/wards
router.get('/', async (req, res) => {
  try {
    const { data: wards, error } = await supabase
      .from('wards')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(wards);
  } catch (error) {
    console.error('Wards API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
