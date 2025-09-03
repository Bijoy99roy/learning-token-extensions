import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DetectWhaleTransferHook } from "../target/types/detect_whale_transfer_hook";
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
import { min } from "bn.js";
import { assert } from "chai";

describe("detect-whale-transfer-hook", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .detectWhaleTransferHook as Program<DetectWhaleTransferHook>;

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

  const [latestWhaleAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("whale_account")],
    program.programId
  );

  it("Create Mint Account with Transfer Hook Extension", async () => {
    const extension = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extension);
    const lamports = await connection.getMinimumBalanceForRentExemption(
      mintLen
    );

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

    const txSig = await sendAndConfirmTransaction(connection, transaction, [
      provider.wallet.payer,
      mint,
    ]);

    console.log("Transaction Signature: ", txSig);
  });

  it("Create Token Account and Mint Tokens", async () => {
    const amount = 10000 * LAMPORTS_PER_SOL;

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

    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [provider.wallet.payer],
      { commitment: "confirmed" }
    );

    console.log("Transaction Signature: ", txSig);
  });

  it("Create ExtraAccountMetaList Account", async () => {
    const initalizeExtraAccountMetaInstruction = await program.methods
      .initializeExtraAccount()
      .accounts({
        mint: mint.publicKey,
        extraAccountMetaList: extraAccountMetaPda,
        latestWhaleAccount: latestWhaleAccountPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    const transaction = new Transaction().add(
      initalizeExtraAccountMetaInstruction
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [
      provider.wallet.payer,
    ]);
    console.log("Transaction Signature: ", txSig);
  });

  it("Transfer Hook with Extra Account Meta", async () => {
    const whaleAmount = BigInt(2000 * LAMPORTS_PER_SOL);
    const transferInstruction =
      await createTransferCheckedWithTransferHookInstruction(
        connection,
        sourceTokenAccount,
        mint.publicKey,
        destinationTokenAccount,
        provider.wallet.publicKey,
        whaleAmount,
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

    const tx = await connection.getTransaction(txSig, {
      commitment: "confirmed",
    });

    const eventParser = new anchor.EventParser(
      program.programId,
      new anchor.BorshCoder(program.idl)
    );

    const events = eventParser.parseLogs(tx.meta.logMessages);
    let logEmitted = false;
    for (let event of events) {
      logEmitted = true;
      if (event.name == "whaleTransferEvent") {
        assert.equal(
          event.data.whaleAddress.toString(),
          provider.wallet.publicKey.toString(),
          "Event whale address should match with actual whale address"
        );
        assert.equal(
          event.data.transferAmount.toString(),
          whaleAmount.toString(),
          "Event transfer amount should match with provider whale amount"
        );
      }
    }

    assert.equal(logEmitted, true, "Should emit event");
  });
});
