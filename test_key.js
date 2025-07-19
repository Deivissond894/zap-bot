// test_key.js
require('dotenv').config(); // Para carregar variáveis de um arquivo .env

const DIALOGFLOW_PRIVATE_KEY = process.env.DIALOGFLOW_PRIVATE_KEY;

console.log('--- Conteúdo da DIALOGFLOW_PRIVATE_KEY ---');
console.log(DIALOGFLOW_PRIVATE_KEY);
console.log('--- Fim do Conteúdo ---');

if (DIALOGFLOW_PRIVATE_KEY && DIALOGFLOW_PRIVATE_KEY.includes('BEGIN PRIVATE KEY') && DIALOGFLOW_PRIVATE_KEY.includes('END PRIVATE KEY')) {
  console.log('A chave parece ter o formato correto (BEGIN/END PRIVATE KEY).');
  console.log('Tamanho da chave (caracteres):', DIALOGFLOW_PRIVATE_KEY.length);
  console.log('Primeiros 50 caracteres:', DIALOGFLOW_PRIVATE_KEY.substring(0, 50));
  console.log('Últimos 50 caracteres:', DIALOGFLOW_PRIVATE_KEY.substring(DIALOGFLOW_PRIVATE_KEY.length - 50));
} else {
  console.log('ATENÇÃO: A chave não parece ter o formato esperado ou está vazia.');
}