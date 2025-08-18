const translate = require('google-translate-api-x');

translate('Welcome to Lodha Builders!', { to: 'hi' }).then(res => {
  console.log(res.text); // expected Hindi output
}).catch(err => {
  console.error('Translation failed:', err);
});