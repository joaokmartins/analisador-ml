# 🧠 Analisador de Preços Inteligente (ML + Gemini)

> API de Inteligência de Mercado que integra a API do Mercado Livre com IA Generativa (Google Gemini) para precificação estratégica e análise de concorrência.

## 🚀 Funcionalidades

- **Autenticação OAuth 2.0**: Conexão segura e persistente com o Mercado Livre.

- **Otimização de Busca (IA)**: Uso do **LangChain** e **Google Gemini** para transformar nomes de produtos em keywords otimizadas de alta conversão.

- **Filtro Estatístico**: Algoritmo de remoção de *outliers* (preços discrepantes) para garantir uma média de mercado realista.

- **API RESTful**: Endpoints claros para integração com front-end ou outros serviços.

## 🛠 Tecnologias Utilizadas

- **Runtime:** Node.js (v18+)

- **Server:** Express

- **AI Orchestration:** LangChain

- **LLM:** Google Gemini (1.5 Flash / 2.5 Flash Exp)

- **Http Client:** Node-fetch

- **Security:** Dotenv

## ⚙️ Configuração do Ambiente

1. Clone o repositório:

```bash

git clone https://github.com/joaokmartins/analisador-ml