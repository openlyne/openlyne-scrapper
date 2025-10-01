const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../logger');

let supabaseClient;
function getClient() {
  if (supabaseClient) return supabaseClient;
  if (!config.supabaseUrl || !config.supabaseServiceKey) return null;
  supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false }
  });
  return supabaseClient;
}

async function uploadScreenshot(buffer, filename) {
  const client = getClient();
  if (!client) return { url: null, stored: false };
  const bucket = config.supabaseBucket;
  const objectPath = `${Date.now()}-${filename}`;
  const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType: 'image/png',
    upsert: false
  });
  if (error) {
    logger.error({ err: error, bucket, objectPath }, 'Supabase upload failed');
    return { url: null, stored: false };
  }
  // Build public URL
  let publicUrl;
  if (config.supabasePublicBaseUrl) {
    publicUrl = `${config.supabasePublicBaseUrl.replace(/\/$/, '')}/${objectPath}`;
  } else {
    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    publicUrl = data.publicUrl;
  }
  return { url: publicUrl, stored: true };
}

module.exports = { uploadScreenshot };
