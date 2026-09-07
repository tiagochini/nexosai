# Fetched source

- URL: https://docs.pagar.me/reference/checkout-link.md
- Title: 
- Retrieved: 2026-09-07

---

---
updatedAt: 2026-04-06T17:51:25.000Z
---

Fetch the complete documentation index at: https://docs.pagar.me/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Link de Pagamento

Para criar um **Link de pagamento/Checkout**, é necessário fazer uma `requisição` para a nossa [API de Checkout](https://docs.pagar.me/reference/create-link). Ela irá gerar um Link de pagamento que dará acesso ao `Checkout` permitindo o comprador efetuar a compra. Você poderá utilizar as seguintes propriedades:

> ❗️ Atenção!
>
> Ao criar Links de pagamento, oferecemos duas opções principais: a geração de um pedido único ou a criação de uma recorrência.
>
> Caso tenha interesse em explorar mais detalhes sobre nosso conceito de [recorrência](https://docs.pagar.me/docs/overview-recorr%C3%AAncia), acesse nossa documentação específica de [assinaturas](https://docs.pagar.me/docs/assinatura) e [planos](https://docs.pagar.me/docs/plano).
>
> **É importante destacar que, no contexto de Links de pagamento, a criação de uma recorrência só pode ser feita se estiver vinculada a um plano.**

| Atributos                                   | Tipo       | Descrição                                                                                                                                              |
| :------------------------------------------ | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                                      | **string** | Define o tipo do link de pagamento a ser criado, podendo ser `order`, para criação de pedidos, ou `subscription`, para recorrências.                   |
| `payment_settings.accepted_payment_methods` | **object** | *Meios de pagamento aceitos para o Checkout*. Valores possíveis: `credit_card`, `boleto`, e `pix`.                                                     |
| `payment_settings.credit_card_settings`     | **object** | Define as configurações de pagamento quando cartão de crédito for selecionado. Obrigatório quando enviado `credit_card` em `accepted_payment_methods`. |
| `payment_settings.boleto_settings`          | **object** | Define as configurações de pagamento quando boleto for selecionado. Obrigatório quando enviado `boleto` em `accepted_payment_methods`.                 |
| `payment_settings.pix_settings`             | **object** | Define as configurações de pagamento quando Pix for selecionado. Obrigatório quando enviado `pix` em `accepted_payment_methods`.                       |
| `customer_settings`                         | **object** | Define os dados do cliente, se aplicável.                                                                                                              |
| `cart_settings`                             | **object** | Define os dados do carrinho que será pago pelo link de pagamento.                                                                                      |
| `cart_settings.items`                       | **object** | Esse objeto deve ser enviado caso o seu Checkout seja do tipo  `order`                                                                                 |
| `cart_settings.recurrence`                  | **object** | Esse objeto deve ser enviado caso o seu Checkout seja doo tipo `subscription`                                                                          |
| `layout_settings`                           | **object** | Dados de layout.                                                                                                                                       |

```json Request - Checkout (Criar)
{
  "is_building": false,
  "payment_settings": {
    "credit_card_settings": {
      "installments_setup": {
        "interest_type": "simple"
      },
      "operation_type": "auth_and_capture",
      "installments": [
        {
          "number": 1,
          "total": 12000
        },
        {
          "number": 2,
          "total": 12000
        }
      ]
    },
    "accepted_payment_methods": [
      "credit_card"
    ]
  },
  "cart_settings": {
    "items": [
      {
        "amount": 12000,
        "name": "Banner",
        "default_quantity": 1
      }
    ]
  },
  "name": "Banner N12345",
  "type": "order"
}
```
```json Response - Checkout (Criar)
{
    "payment_settings": {
        "accepted_payment_methods": [
            "credit_card"
        ],
        "credit_card_settings": {
            "operation_type": "auth_and_capture",
            "installments": [
                {
                    "number": 1,
                    "total": 12000
                },
                {
                    "number": 2,
                    "total": 12000
                }
            ]
        }
    },
    "cart_settings": {
        "items": [
            {
                "amount": 12000,
                "name": "Banner",
                "default_quantity": 1
            }
        ],
       "items_total_cost": 12000,
       "total_cost": 12000,
       "shipping_cost": 0,
       "shipping_total_cost": 0,
    },
    "name": "Banner N12345",
    "type": "order",
    "total_sessions": 0,
    "max_paid_sessions": 0,
    "total_paid_sessions": 0,
    "max_sessions": 0,
    "created_at": "2024-05-13T01:09:40.6331583Z",
    "url": "https://payment-link.pagar.me/pl_GNe8zkaO2MlBxxGcJcv0BALq9Pon514W",
    "updated_at": "2024-05-13T01:09:40.6331583Z",
    "id": "pl_GNe8zkaO2MlBxxGcJcv0BALq9Pon514W",
    "expires_in": 0,
    "status": "active"
}
```
```php Request - Checkout Recorrência (Criar)
{
  "is_building": false,
  "payment_settings": {
    "credit_card_settings": {
      "installments_setup": {
        "interest_type": "simple"
      },
      "operation_type": "auth_and_capture"
    },
    "accepted_payment_methods": [
      "credit_card"
    ]
  },
  "customer_settings": {
    "customer_id": "cus_8ka4RGDF9F7MvemD"
  },
  "cart_settings": {
    "recurrences": [
      {
        "start_in": 1,
        "plan_id": "plan_odzJgEyf9fqgR7Kj"
      }
    ]
  },
  "max_paid_sessions": 1,
  "expires_at": "2024-05-12T19:44:39.5870000Z",
  "name": "Banner mensal N135",
  "type": "subscription"
}
```