# Transfer Hook Extension

Transfer Hook is part of a collection of extensions introduced with Token22 program.

It allows you to execute custom logic while transfering tokens.

### Test

- Run a seperate solana-test-validator in seperate terminal
- Run `anchor test --skip-test-validator`
- Copy the transaction signature for `Transfer Hook with Extra Account Meta` test
- Run `solana confirm -v <TransactionSignature>`

### References

- https://solana.com/developers/guides/token-extensions/transfer-hook
