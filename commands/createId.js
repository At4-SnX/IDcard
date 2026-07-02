const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require("discord.js");
const storage = require("../utils/storage");
const { resolveRobloxPlayer } = require("../utils/roblox");
const { renderIdCard } = require("../utils/cardRenderer");
const { getBannerAttachment, BANNER_FILENAME } = require("../utils/branding");
const theme = require("../config/cardTheme");

const MAX_CARDS_PER_USER = parseInt(process.env.MAX_CARDS_PER_USER || "2", 10);
const ROLE_TO_REMOVE_ID = process.env.ROLE_TO_REMOVE_ID || "";
const ROLE_TO_ADD_ID = process.env.ROLE_TO_ADD_ID || "";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";

const CREATE_BUTTON_ID = "nova_create_open_modal";
const CREATE_MODAL_ID = "nova_create_modal";
const BRAND_COLOR = 0x2c2568;

/**
 * Envoie l'invitation publique (embed + bouton) suite au mot déclencheur
 * "nova.id". Rien de privé n'est encore échangé à ce stade.
 */
async function sendPrompt(message) {
  const banner = getBannerAttachment();

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🌴 Cité-État de Nova — Carte d'identité citoyenne")
    .setDescription(
      "Clique sur le bouton ci-dessous pour remplir ta demande de carte d'identité.\n" +
        "Le formulaire et le résultat te seront envoyés **en privé** : personne d'autre ne pourra les voir."
    )
    .setImage(`attachment://${BANNER_FILENAME}`)
    .setFooter({ text: "Service des Cartes d'Identité de Nova" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CREATE_BUTTON_ID)
      .setLabel("Remplir le formulaire")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );

  await message.channel.send({ embeds: [embed], components: [row], files: [banner] });
}

/**
 * Déclenché quand quelqu'un clique sur le bouton "Remplir le formulaire".
 */
async function handleButton(interaction) {
  const existingCount = storage.countCardsByCreator(interaction.user.id);
  if (existingCount >= MAX_CARDS_PER_USER) {
    await interaction.reply({
      content: `⚠️ Tu as déjà atteint la limite de **${MAX_CARDS_PER_USER}** cartes d'identité créées.`,
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder().setCustomId(CREATE_MODAL_ID).setTitle("Carte d'identité — Nova");

  const robloxInput = new TextInputBuilder()
    .setCustomId("roblox_username")
    .setLabel("Pseudo Roblox")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: builderman")
    .setMaxLength(20)
    .setRequired(true);

  const nomInput = new TextInputBuilder()
    .setCustomId("nom")
    .setLabel("Nom / Surname")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(30)
    .setRequired(true);

  const prenomsInput = new TextInputBuilder()
    .setCustomId("prenoms")
    .setLabel("Prénoms / Given names")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(40)
    .setRequired(true);

  const naissanceInput = new TextInputBuilder()
    .setCustomId("naissance")
    .setLabel("Naissance (JJ/MM/AAAA - Ville)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Ex: 13/07/1990 - Hamburg")
    .setMaxLength(60)
    .setRequired(true);

  const sexeInput = new TextInputBuilder()
    .setCustomId("sexe")
    .setLabel("Sexe (M ou F)")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(1)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(robloxInput),
    new ActionRowBuilder().addComponents(nomInput),
    new ActionRowBuilder().addComponents(prenomsInput),
    new ActionRowBuilder().addComponents(naissanceInput),
    new ActionRowBuilder().addComponents(sexeInput)
  );

  await interaction.showModal(modal);
}

/**
 * Déclenché à la soumission du formulaire.
 */
async function handleModalSubmit(interaction) {
  const existingCount = storage.countCardsByCreator(interaction.user.id);
  if (existingCount >= MAX_CARDS_PER_USER) {
    await interaction.reply({
      content: `⚠️ Tu as déjà atteint la limite de **${MAX_CARDS_PER_USER}** cartes d'identité créées.`,
      ephemeral: true,
    });
    return;
  }

  const robloxUsername = interaction.fields.getTextInputValue("roblox_username").trim();
  const nom = interaction.fields.getTextInputValue("nom").trim();
  const prenoms = interaction.fields.getTextInputValue("prenoms").trim();
  const naissanceRaw = interaction.fields.getTextInputValue("naissance").trim();
  const sexeRaw = interaction.fields.getTextInputValue("sexe").trim().toUpperCase();

  if (sexeRaw !== "M" && sexeRaw !== "F") {
    await interaction.reply({
      content: "⚠️ Le champ **Sexe** doit être `M` ou `F`. Recommence en cliquant à nouveau sur le bouton.",
      ephemeral: true,
    });
    return;
  }

  const naissanceParts = naissanceRaw.split(/\s*-\s*/);
  const dateValid =
    naissanceParts.length >= 2 &&
    naissanceParts[0] &&
    naissanceParts[1] &&
    /^\d{2}\/\d{2}\/\d{4}$/.test(naissanceParts[0].trim());

  if (!dateValid) {
    await interaction.reply({
      content:
        "⚠️ Le champ **Naissance** doit suivre le format `JJ/MM/AAAA - Ville` (ex: `13/07/1990 - Hamburg`). Recommence en cliquant à nouveau sur le bouton.",
      ephemeral: true,
    });
    return;
  }
  const dateNaissance = naissanceParts[0].trim();
  const lieuNaissance = naissanceParts.slice(1).join(" - ").trim();

  await interaction.deferReply({ ephemeral: true });

  let robloxPlayer;
  try {
    robloxPlayer = await resolveRobloxPlayer(robloxUsername);
  } catch (error) {
    console.error("[NOVA ID] Erreur API Roblox:", error);
    await interaction.editReply(
      "⚠️ Impossible de contacter l'API Roblox pour le moment. Réessaie dans un instant."
    );
    return;
  }

  if (!robloxPlayer) {
    await interaction.editReply(`⚠️ Aucun joueur Roblox nommé **${robloxUsername}** n'a été trouvé.`);
    return;
  }

  if (storage.countCardsByCreator(interaction.user.id) >= MAX_CARDS_PER_USER) {
    await interaction.editReply(`⚠️ Tu as atteint la limite de **${MAX_CARDS_PER_USER}** cartes entre-temps.`);
    return;
  }

  const documentNo = storage.generateDocumentNumber();
  const dateExpir = computeExpiryDate(theme.VALIDITY_YEARS);

  let imageBuffer;
  try {
    imageBuffer = await renderIdCard({
      nom,
      prenoms,
      sexe: sexeRaw,
      dateNaissance,
      lieuNaissance,
      documentNo,
      dateExpir,
      avatarUrl: robloxPlayer.avatarUrl,
    });
  } catch (error) {
    console.error("[NOVA ID] Erreur de génération de la carte:", error);
    await interaction.editReply("⚠️ Une erreur est survenue lors de la génération de l'image de la carte.");
    return;
  }

  storage.addCard({
    createdByDiscordId: interaction.user.id,
    robloxUsername: robloxPlayer.user.name,
    robloxUserId: robloxPlayer.user.id,
    nom,
    prenoms,
    sexe: sexeRaw,
    dateNaissance,
    lieuNaissance,
    documentNo,
    dateExpir,
    createdAt: new Date().toISOString(),
  });

  await applyPostCreationEffects(interaction);

  const cardAttachment = new AttachmentBuilder(imageBuffer, { name: "carte-identite-nova.png" });

  const resultEmbed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🪪 Carte d'identité délivrée")
    .setDescription(
      `Ta carte a été enregistrée sous le numéro **${documentNo}**.\nElle n'est visible que par toi.`
    )
    .setImage("attachment://carte-identite-nova.png")
    .setFooter({ text: "Cité-État de Nova • Document officiel" });

  await interaction.editReply({ embeds: [resultEmbed], files: [cardAttachment] });

  if (LOG_CHANNEL_ID) {
    try {
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        const logAttachment = new AttachmentBuilder(imageBuffer, { name: "carte-identite-nova.png" });
        const logEmbed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle("🪪 Nouvelle carte enregistrée")
          .addFields(
            { name: "Créée par", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Joueur Roblox", value: robloxPlayer.user.name, inline: true },
            { name: "N° de document", value: documentNo, inline: true }
          )
          .setImage("attachment://carte-identite-nova.png")
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed], files: [logAttachment] });
      } else {
        console.error("[NOVA ID] LOG_CHANNEL_ID ne pointe pas vers un salon textuel valide.");
      }
    } catch (error) {
      console.error("[NOVA ID] Impossible d'envoyer dans le salon logs:", error);
    }
  }
}

function computeExpiryDate(yearsFromNow) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsFromNow);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function applyPostCreationEffects(interaction) {
  try {
    const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id));

    if (ROLE_TO_REMOVE_ID && member.roles.cache.has(ROLE_TO_REMOVE_ID)) {
      await member.roles
        .remove(ROLE_TO_REMOVE_ID)
        .catch((err) => console.error("[NOVA ID] Impossible de retirer le rôle:", err.message));
    }

    if (ROLE_TO_ADD_ID && !member.roles.cache.has(ROLE_TO_ADD_ID)) {
      await member.roles
        .add(ROLE_TO_ADD_ID)
        .catch((err) => console.error("[NOVA ID] Impossible d'ajouter le rôle:", err.message));
    }

    // Renomme automatiquement le membre en "[C]〃<pseudo Discord>" pour
    // marquer visuellement les citoyens enregistrés.
    const prefix = "[C]〃";
    const maxUsernameLength = 32 - prefix.length;
    const discordUsername = interaction.user.username.slice(0, maxUsernameLength);
    const newNickname = `${prefix}${discordUsername}`;

    if (member.nickname !== newNickname) {
      await member.setNickname(newNickname).catch((err) =>
        console.error("[NOVA ID] Impossible de renommer le membre:", err.message)
      );
    }
  } catch (error) {
    console.error("[NOVA ID] Erreur lors des effets post-création:", error);
  }
}

module.exports = { CREATE_BUTTON_ID, CREATE_MODAL_ID, sendPrompt, handleButton, handleModalSubmit };
