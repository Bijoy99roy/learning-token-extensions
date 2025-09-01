# Transfer Hook Extension

Transfer Hook is part of a collection of extensions introduced with Token22 program.

It allows you to execute custom logic while transfering tokens.

**Why can't someone just write custom logic in their contract instead of using the extension?**

In normal contract one can bypass the custom logic by calling the transfer seperately.
But TransferHook Extension enfores the logic on transfer level itself.

### Test

- Run a seperate solana-test-validator in seperate terminal
- Run `anchor test --skip-test-validator`
- Copy the transaction signature for `Transfer Hook with Extra Account Meta` test
- Run `solana confirm -v <TransactionSignature>`

### References

- https://solana.com/developers/guides/token-extensions/transfer-hook
