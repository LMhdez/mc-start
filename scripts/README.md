# Scripts de manutenção e build

Scripts deste diretório são auxiliares do repositório `mc-start`; não assumem acesso seguro à VM nem autorização para alterar produção.

## Inventário

- `patch-essential-commands-afk.py`: aplica uma patch estrita e fail-closed à fonte upstream do Essential Commands 26.x. Espera exatamente um match por transformação; falha se a fonte divergir. Usado por `.github/workflows/build-essential-commands-afk.yml`.
- O workflow compila um artefacto personalizado (warning 25 min / kick 30 min, isenções); não instala nem substitui automaticamente o JAR da VM.

## Como validar

- Executar testes de sintaxe/patch apenas em checkout isolado.
- Não apontar o script a um clone de produção ou ao diretório de mods da VM.
- A compilação real é responsabilidade do workflow dedicado e deve fixar commit upstream, Java e versão Minecraft.
- Guardar artefactos apenas dentro da retenção definida; não depender de artefactos temporários como fonte permanente.

## Segurança e custos

- Nunca imprimir tokens, passwords, chaves privadas, env vars ou ficheiros completos de configuração.
- Não adicionar dependências/mods ao servidor sem necessidade e compatibilidade confirmadas.
- Não executar comandos que instalem ou atualizem software na VM.
- Custo permitido: 0,00 €; não ativar serviços ou runners pagos.
