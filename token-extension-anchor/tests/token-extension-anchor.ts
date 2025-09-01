import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtensionAnchor } from "../target/types/token_extension_anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

describe("token-extension-anchor", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .tokenExtensionAnchor as Program<TokenExtensionAnchor>;
  const provider = anchor.getProvider();
  const connection = provider.connection;

  const mint = anchor.web3.Keypair.generate();
  const decimals = 9;

  const recipient = anchor.web3.Keypair.generate();

  const sourceTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    provider.wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const destinationTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const [extraAccountMetaPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
    program.programId
  );

  it("Create Mint Account with Transfer Hook Extension", async () => {
    const extension = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extension);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        provider.wallet.publicKey,
        program.programId,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        provider.wallet.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txnSig = await sendAndConfirmTransaction(connection, transaction, [
      provider.wallet.payer,
      mint,
    ]);

    console.log(`Transaction Signature: ${txnSig}`);
  });

  it("Create token account and Mint tokens", async () => {
    const amount = 100 * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        sourceTokenAccount,
        provider.wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint.publicKey,
        sourceTokenAccount,
        provider.wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [
      provider.wallet.payer,
    ]);

    console.log("Transaction Signature: ", txSig);
  });

  it("Create ExtraAccountMetaList Account", async () => {
    const initalizeExtraAccountMetaListInstruction = await program.methods
      .intializeExtraAccountMetaList()
      .accounts({
        mint: mint.publicKey,
        extraAccountMetaList: extraAccountMetaPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
    const transaction = new Transaction().add(
      initalizeExtraAccountMetaListInstruction
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [
      provider.wallet.payer,
    ]);

    console.log("Transaction Signature: ", txSig);
  });

  it("Transfer Hook with Extra Account Meta", async () => {
    const amount = 1 * LAMPORTS_PER_SOL;
    const bigIntAmount = BigInt(amount);

    // Standard token transfer instruction
    const transferInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        connection,
        sourceTokenAccount,
        mint.publicKey,
        destinationTokenAccount,
        provider.wallet.publicKey,
        bigIntAmount,
        decimals,
        [],
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

    const transaction = new Transaction().add(transferInstruction);
    const txSig = await sendAndConfirmTransaction(connection, transaction, [
      provider.wallet.payer,
    ]);

    console.log("Transaction Signature: ", txSig);
  });
});
