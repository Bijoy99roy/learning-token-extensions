import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenExtensionAnchor } from "../target/types/token_extension_anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
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
});
